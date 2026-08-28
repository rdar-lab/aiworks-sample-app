from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter

from aiworks_core.urls import api_urlpatterns
from aiworks_core.views import views_utils

from .views import (
    session_views
)

# APP-specific router entries (aiworks_core routes are included from aiworks_core.urls)
router = DefaultRouter()
router.register(r"sessions", session_views.SessionViewSet, basename="session")

urlpatterns = [
    # Custom endpoint to serve session attachment files (supports paths with slashes,
    # e.g. assets/js/main.js) — must be declared before the router include so that
    # Django matches this pattern before trying the generic sessions/{pk}/ routes.
    # The {token} path segment carries the JWT access token (or "public" for public
    # sessions), allowing iframe sub-resources to authenticate automatically via
    # relative URL resolution without needing custom request headers.
    re_path(
        r"^sessions/(?P<session_id>[^/]+)/attachment/(?P<token>[^/]+)/(?P<attachment_path>.+)$",
        views_utils.jwt_session_attachment,
        name="session_attachment",
    ),
    re_path(
        r"^sessions/(?P<pk>[^/]+)/session_attachment/(?P<attachment_path>.+)$",
        session_views.SessionViewSet.as_view({"get": "session_attachment"}),
        name="session_attachment_drf",
    ),
    # Include aiworks_core URLs — handles knowledge-bases, mcp-servers,
    # predefined-mcp-servers, auth/*, help-chat, memory/*, mcp-tunnel/*
    path("", include(api_urlpatterns)),
    path("", include(router.urls)),
]
