"""Central email service for AiWorks.

All outbound emails go through this module.  Call sites (views.py, logic.py)
should import and use EmailService static methods — never call send_mail
directly.
"""

import logging

from aiworks_core.logic.emails import EmailService as AiWorksEmailService
from aiworks_core.models import SiteConfiguration

logger = logging.getLogger(__name__)

# Suppress cssutils warnings about vendor-prefixed CSS properties (-webkit-*, -ms-*, mso-*)
# that premailer's CSS parser doesn't recognise but are required for email-client compatibility.
# cssutils uses the logger name 'CSSUTILS' (uppercase) via its own ErrorHandler wrapper.
logging.getLogger("CSSUTILS").setLevel(logging.ERROR)


def _get_site_config():
    """Return the SiteConfiguration singleton."""
    return SiteConfiguration.get_solo()


class EmailService:
    """Thin service layer for sending AiWorks emails.

    Each method renders both HTML and plain-text templates and sends a
    multipart email.  Failures are logged but never re-raised so callers
    do not crash on email errors.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @staticmethod
    def send_research_complete_email(user, session) -> None:
        """Notify a user that their research report is ready."""
        if not user.email:
            return

        config = _get_site_config()
        site_url = (config.site_url or "").strip().rstrip("/")
        from_email = config.default_from_email or None
        session_url = f"{site_url}/?session={session.id}" if site_url else None

        context = {
            "user": user,
            "session": session,
            "session_url": session_url,
            "site_url": site_url,
        }
        subject = "Your research report is ready"
        AiWorksEmailService.send(
            subject=subject,
            template_name="research_complete",
            context=context,
            recipient_email=user.email,
            from_email=from_email,
        )
        logger.info("email_service | research complete email sent to %s", user.email)

