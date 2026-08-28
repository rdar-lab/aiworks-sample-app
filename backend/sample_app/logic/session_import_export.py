"""Session export and import for Django admin.

Provides the ability to export a complete session (with all sub-models and
attached files) as a JSON manifest, and to re-import that manifest to create
a new session under a chosen user.

ZIP structure (produced by export, consumed by import)
------------------------------------------------------
The export produces a ZIP containing one file::

    session_export.json   – JSON manifest (UTF-8)

The JSON schema::

    {
      "version": 1,
      "exported_at": "<ISO datetime>",
      "session": { <Session field dict> },
      "sub_models": {
        "worker_task":       <WorkerTask field dict> | null,
      },
      "files": [
        {
          "metadata": { <AttachedFile field dict> },
          "binary_base64": "<base64 encoded bytes or empty string if offloaded>"
        }
      ],
      "knowledge_bases": [ { "id": <KB id>, "name": "<name>" } ],
      "mcp_servers":    [ { "id": <MCP id>, "name": "<name>" } ]
    }

Key design decisions
--------------------
* The import always creates a brand-new session (new UUID); the original
  session is never modified.
* User ownership is transferred to the target user specified at import time.
* M2M relations (knowledge_bases, mcp_servers) are re-linked by name — if a
  KB/MCP with the given name does not exist under the target user, the link is
  silently skipped.
* Binary content for AttachedFiles is included as base64 strings.  If the
  cold-storage backend is offloaded (None backend), the binary is still
  included in the manifest so the imported session is fully self-contained.
* WorkerTask records are exported in full but imported with status reset to
  ``pending`` so the watchdog can pick them up normally.
* SessionSnapshots are ignored.
"""

import base64
import io
import json
import logging
import uuid
import zipfile
from typing import Optional, Any, cast

from aiworks_core.logic.files import get_binary_data, set_binary_content
from aiworks_core.models import (
    AttachedFile,
    KnowledgeBase,
    MCPServer,
    SessionSnapshot,
    WorkerTask,
)
from django.db import transaction

from ..models import (
    AppSession,
)

logger = logging.getLogger(__name__)

EXPORT_VERSION = 1


class SessionExportError(Exception):
    """Raised when session export fails."""


# --------------------------------------------------------------------------- #
# Export
# --------------------------------------------------------------------------- #


def export_session(session: AppSession) -> bytes:
    """Export *session* and all related data as a ZIP.

    Returns raw ZIP bytes suitable for returning as an HTTP response attachment.

    Raises ``ExportError`` if the session cannot be exported.
    """
    try:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            manifest = _build_manifest(session)
            zf.writestr("session_export.json", json.dumps(manifest, indent=2, default=str))
    except SessionExportError:
        logger.exception("Failed to export session %s", session.id)
        raise
    except Exception as exc:
        logger.exception("Failed to export session %s", session.id)
        raise SessionExportError(f"Failed to export session: {exc}") from exc

    return buf.getvalue()


def _build_manifest(session: AppSession) -> dict:
    """Build the full export manifest dict for *session*."""
    manifest = {
        "version": EXPORT_VERSION,
        "exported_at": session.updated_at.isoformat() if session.updated_at else None,
        "session": _serialize_session(session),
        "sub_models": _serialize_sub_models(session),
        "files": _serialize_files(session),
        "knowledge_bases": _serialize_kb_refs(session),
        "mcp_servers": _serialize_mcp_refs(session),
    }
    return manifest


def _serialize_session(session: AppSession) -> dict:
    return _strip_readonly_fields(_model_to_dict(session), AppSession)


def _serialize_sub_models(session: AppSession) -> dict:
    result = {}

    wt: Optional[WorkerTask] = getattr(session, "worker_task", None)
    result["worker_task"] = _strip_readonly_fields(_model_to_dict(wt), WorkerTask) if wt else None

    return result


def _serialize_files(session: AppSession) -> list:
    result = []
    for af in session.attached_files.all():
        binary_data = get_binary_data(af) or b""
        entry = {
            "metadata": _strip_readonly_fields(_model_to_dict(af), AttachedFile),
            "binary_base64": base64.b64encode(binary_data).decode("ascii"),
        }

        result.append(entry)
    return result


def _serialize_kb_refs(session: AppSession) -> list:
    kbs = cast(list[KnowledgeBase], list(session.knowledge_bases.all()))
    return [{"id": kb.id, "name": kb.name} for kb in kbs]


def _serialize_mcp_refs(session: AppSession) -> list:
    mcps = cast(list[MCPServer], list(session.mcp_servers.all()))
    return [{"id": mcp.id, "name": mcp.name} for mcp in mcps]


# --------------------------------------------------------------------------- #
# Import
# --------------------------------------------------------------------------- #


class SessionImportError(Exception):
    """Raised when the import manifest is invalid or incompatible."""


def import_session(zip_bytes: bytes, target_user) -> AppSession:
    """Import a session from *zip_bytes* (export ZIP) into *target_user*.

    Creates a brand-new Session (new UUID) owned by *target_user*.  All
    sub-models and attached files are replicated under the new session.

    *session_id* — optional explicit session ID to use; a new UUID is generated
    if not supplied.

    Returns the newly created ``Session`` instance.

    Raises ``SessionImportError`` if the manifest is invalid or incompatible.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes), mode="r") as zf:
            if "session_export.json" not in zf.namelist():
                raise SessionImportError("ZIP does not contain session_export.json")
            raw = zf.read("session_export.json").decode("utf-8")
    except Exception as exc:
        logger.exception("Failed to read session export ZIP")
        raise SessionImportError(f"Could not read ZIP: {exc}") from exc

    try:
        manifest = json.loads(raw)
    except Exception as exc:
        logger.exception("Failed to parse session export manifest JSON")
        raise SessionImportError(f"Could not parse JSON: {exc}") from exc

    version = manifest.get("version")
    if version != EXPORT_VERSION:
        raise SessionImportError(
            f"Unsupported export version {version} (expected {EXPORT_VERSION}). "
            "Please ensure the backend is up to date."
        )

    session_data = manifest.get("session", {})
    sub_models = manifest.get("sub_models", {})
    files_data = manifest.get("files", [])
    kb_refs = manifest.get("knowledge_bases", [])
    mcp_refs = manifest.get("mcp_servers", [])

    with transaction.atomic():
        session_id = f"session_{uuid.uuid4().hex[:12]}"
        session_data_copy = {k: v for k, v in session_data.items() if k != 'session_ptr'}
        session: Any = _create_model_object(AppSession, session_data_copy,
                                            override_data={"user": target_user, "id": session_id})
        if not session:
            raise SessionImportError("Session was not created")
        _create_model_object(WorkerTask, sub_models.get("worker_task"), override_data={"session": session})

        _link_kb_and_mcp(session, target_user, kb_refs, mcp_refs)

        _create_attached_files(session, files_data)

    logger.info(
        "session_import_export.import_session | new_session=%s | user=%s | original_session=%s",
        session.id,
        target_user,
        session_data.get("id", "unknown"),
    )
    return session


def _create_model_object(model_entity, data: list | dict, override_data: Optional[dict] = None):
    if not data:
        return None

    if isinstance(data, list):
        data = [item for item in data if item]
        return [
            _create_model_object(model_entity, item, override_data)
            for item in data
        ]

    if not override_data:
        override_data = {}

    return model_entity.objects.create(
        **data,
        **override_data
    )


def _link_kb_and_mcp(
        session: AppSession, user, kb_refs: list, mcp_refs: list
) -> None:
    for kb_ref in kb_refs:
        try:
            kb = KnowledgeBase.objects.get(name=kb_ref["name"], user=user)
            session.knowledge_bases.add(kb)
        except KnowledgeBase.DoesNotExist:
            pass

    for mcp_ref in mcp_refs:
        try:
            mcp = MCPServer.objects.get(name=mcp_ref["name"], user=user)
            session.mcp_servers.add(mcp)
        except MCPServer.DoesNotExist:
            pass


def _create_attached_files(session: AppSession, files_data: list) -> None:
    for entry in files_data:
        meta = entry["metadata"]
        binary_b64 = entry.get("binary_base64", "")

        try:
            binary_bytes = base64.b64decode(binary_b64) if binary_b64 else b""
        except Exception:
            binary_bytes = b""

        af = AttachedFile.objects.create(
            session=session,
            name=meta["name"],
            file_type=meta["file_type"],
            is_hidden=meta.get("is_hidden", False),
        )

        if binary_bytes:
            set_binary_content(af, binary_bytes)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _model_to_dict(instance) -> dict:
    """Return a dict of all concrete fields on *instance*."""
    fields = {}
    for field in instance._meta.get_fields():
        if field.concrete:
            val = getattr(instance, field.name, None)
            if hasattr(val, "id"):
                val = val.id
            elif hasattr(val, "pk"):
                val = val.pk
            fields[field.name] = val
    return fields


_READONLY_FIELDS = {
    WorkerTask: {"id", "session"},
    AttachedFile: {"id", "session"},
    SessionSnapshot: {"id", "session"},
}


def _strip_readonly_fields(data: dict, model_cls) -> dict:
    """Remove read-only fields from *data* using *model_cls*."""
    readonly = _READONLY_FIELDS.get(model_cls, set())
    return {k: v for k, v in data.items() if k not in readonly and v is not None}
