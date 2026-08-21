package com.portfolio.saas.common.exception;

import java.time.LocalDateTime;
import java.util.List;

public record ApiError(
        int status,
        String error,
        String message,
        String path,
        LocalDateTime timestamp,
        List<String> details
) {
    public ApiError(int status, String error, String message, String path) {
        this(status, error, message, path, LocalDateTime.now(), List.of());
    }

    public ApiError(int status, String error, String message, String path, List<String> details) {
        this(status, error, message, path, LocalDateTime.now(), details);
    }
}
