import logging

from blind50.api.middleware import (
    configure_request_logging,
    redacted_request_path,
)


def test_request_logging_redacts_session_identifiers() -> None:
    assert (
        redacted_request_path(
            "/api/v1/sessions/019f725d-6d48-7692-90e2-b5c47d08eec9/votes"
        )
        == "/api/v1/sessions/{session_id}/votes"
    )


def test_request_logging_preserves_non_session_paths() -> None:
    assert redacted_request_path("/api/v1/ready") == "/api/v1/ready"


def test_request_logging_configures_a_runtime_stream_handler() -> None:
    logger = logging.getLogger("blind50.test.request")
    logger.handlers.clear()

    configure_request_logging("INFO", logger=logger)

    assert logger.level == logging.INFO
    assert len(logger.handlers) == 1
    assert isinstance(logger.handlers[0], logging.StreamHandler)
