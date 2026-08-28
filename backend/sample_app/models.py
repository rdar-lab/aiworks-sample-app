"""
api.models — App models.

Shared models (KnowledgeBase, MCPServer, WorkerTask, etc.) are imported from
aiworks_core. APP-specific models (Persona, Advice, Synthesis, etc.) are defined here.

Session extension: AppSession is a separate table with a OneToOneField to
aiworks_core.Session. This avoids MTI conflicts while keeping all session data
accessible via session.aiworks_extension.<field>.

User extension: UserProfile is a separate table with a OneToOneField to
aiworks_core.User, storing all APP-specific user fields.
"""

from aiworks_core.models import Session
from django.db import models

DEFAULT_FREE_RESEARCH_LIMIT = 0
DEFAULT_PRO_RESEARCH_LIMIT = 5


# ---------------------------------------------------------------------------
# UserProfile — APP-specific user fields (stored in User.extra_data JSON)
# ---------------------------------------------------------------------------
# aiworks_core.User.extra_data stores all APP-specific fields as JSON.
# UserProfile is a plain Python class (not a Django model) that wraps the
# extra_data dict for convenient access. Code uses UserProfile(user).field.


class UserProfile:
    """APP-specific user fields stored in User.extra_data (JSONField).

    All fields are stored in user.extra_data dict. This class provides
    property access to the JSON fields for convenient APP field access.
    """

    def __init__(self, user):
        self._user = user
        if user.extra_data is None:
            user.extra_data = {}
        self._data = user.extra_data

    # ---- APP API fields (read/written by UserSerializer via extra_data) ----
    @property
    def research_daily_count(self):
        return self._data.get('research_daily_count', 0)

    @research_daily_count.setter
    def research_daily_count(self, value):
        self._data['research_daily_count'] = value

    @property
    def research_last_used_date(self):
        from datetime import date
        val = self._data.get('research_last_used_date')
        if isinstance(val, str):
            return date.fromisoformat(val)
        return val

    @research_last_used_date.setter
    def research_last_used_date(self, value):
        if hasattr(value, 'isoformat'):
            value = value.isoformat()
        self._data['research_last_used_date'] = value

    @property
    def research_daily_limit(self):
        return self._data.get('research_daily_limit', 0)

    @research_daily_limit.setter
    def research_daily_limit(self, value):
        self._data['research_daily_limit'] = value

    def get_effective_research_limit(self):
        limit = self._data.get('research_daily_limit')
        return limit or (DEFAULT_PRO_RESEARCH_LIMIT if self._user.tier == "pro" else DEFAULT_FREE_RESEARCH_LIMIT)


# ---------------------------------------------------------------------------
# AppSession — APP-specific session fields (MTI child of Session)
# ---------------------------------------------------------------------------
# AppSession extends aiworks_core.Session via multi-table inheritance.
# The shared session data (id, user, session_type, etc.) comes from aiworks_core.Session.
# APP-specific fields are defined here.


class AppSession(Session):
    """APP-specific session fields. MTI child of aiworks_core.Session."""

    SESSION_TYPE_RESEARCH = "research"

    SESSION_TYPE_CHOICES = [
        (SESSION_TYPE_RESEARCH, "Research Report"),
    ]

    dilemma = models.TextField(blank=True)

    compressed_context = models.TextField(blank=True)
    compressed_file_content = models.TextField(blank=True)
    prev_session = models.TextField(blank=True)
    additional_user_comments = models.TextField(blank=True)

    class Meta:
        proxy = False
        verbose_name = "Session"
        verbose_name_plural = "Sessions"

    def get_effective_dilemma(self):
        if self.additional_user_comments:
            return f"{self.dilemma}. ADDITIONAL USER COMMENTS: {self.additional_user_comments}"
        return self.dilemma
