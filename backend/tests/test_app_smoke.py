"""Smoke tests for the aiworks-sample-app host application.

These cover the app-specific layer: the research-limit rules, the session
model, and the API surface the host app registers on top of aiworks-core.
"""

from django.urls import reverse

from sample_app.models import (
    DEFAULT_FREE_RESEARCH_LIMIT,
    DEFAULT_PRO_RESEARCH_LIMIT,
    AppSession,
    UserProfile,
)


class AppConfigurationTests:
    """The host app must be installed and wired into the project."""

    def test_app_is_installed(self):
        from django.apps import apps

        assert apps.is_installed("sample_app")

    def test_user_model_is_aiworks_core(self):
        from django.conf import settings

        assert settings.AUTH_USER_MODEL == "aiworks_core.User"

    def test_executor_factory_is_configured(self):
        from django.conf import settings

        assert settings.AIWORKS_CORE_EXECUTOR_FACTORY.startswith("sample_app.")

    def test_prompts_file_exists(self):
        from pathlib import Path

        from django.conf import settings

        assert Path(settings.AIWORKS_CORE_PROMPTS_FILE).is_file()


class ApiUrlsTests:
    """The host app must expose its session routes and inherit core's."""

    def test_session_list_resolves(self):
        assert reverse("session-list") == "/api/sessions/"

    def test_core_auth_routes_are_mounted(self):
        assert reverse("login") == "/api/auth/login/"
        assert reverse("register") == "/api/auth/register/"
        assert reverse("verify_email") == "/api/auth/verify-email/"

    def test_core_resource_routes_are_mounted(self):
        assert reverse("knowledge-base-list") == "/api/knowledge-bases/"
        assert reverse("mcp-server-list") == "/api/mcp-servers/"


class UserProfileTests:
    """Research limits are derived from the tier unless overridden."""

    def test_free_tier_uses_default_limit(self, user):
        assert UserProfile(user).get_effective_research_limit() == DEFAULT_FREE_RESEARCH_LIMIT

    def test_pro_tier_uses_default_limit(self, pro_user):
        assert UserProfile(user=pro_user).get_effective_research_limit() == DEFAULT_PRO_RESEARCH_LIMIT

    def test_explicit_limit_overrides_tier(self, pro_user):
        profile = UserProfile(pro_user)
        profile.research_daily_limit = 42
        assert profile.get_effective_research_limit() == 42

    def test_daily_count_round_trips(self, user):
        profile = UserProfile(user)
        profile.research_daily_count = 3
        assert profile.research_daily_count == 3

    def test_last_used_date_round_trips(self, user):
        import datetime

        profile = UserProfile(user)
        today = datetime.date.today()
        profile.research_last_used_date = today
        assert profile.research_last_used_date == today


class AppSessionTests:
    """AppSession extends the shared Session with app-specific fields."""

    def test_dilemma_is_returned_verbatim(self, user):
        session = AppSession.objects.create(
            id="sess-dilemma",
            user=user,
            session_type=AppSession.SESSION_TYPE_RESEARCH,
            session_title="Should we pivot?",
            dilemma="Should we pivot?",
        )
        assert session.get_effective_dilemma() == "Should we pivot?"

    def test_additional_comments_are_appended(self, user):
        session = AppSession.objects.create(
            id="sess-comments",
            user=user,
            session_type=AppSession.SESSION_TYPE_RESEARCH,
            session_title="Should we pivot?",
            dilemma="Should we pivot?",
            additional_user_comments="Focus on pricing.",
        )
        assert session.get_effective_dilemma() == (
            "Should we pivot?. ADDITIONAL USER COMMENTS: Focus on pricing."
        )
