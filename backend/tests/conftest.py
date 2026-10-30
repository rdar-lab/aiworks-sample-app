"""Shared pytest fixtures for the aiworks-sample-app test suite."""

import pytest


@pytest.fixture
def user(db):
    """A verified user on the free tier."""
    from aiworks_core.tests import _make_user

    return _make_user(username="testuser", email="test@example.com", tier="free")


@pytest.fixture
def pro_user(db):
    """A verified user on the pro tier."""
    from aiworks_core.tests import _make_user

    return _make_user(username="prouser", email="pro@example.com", tier="pro")
