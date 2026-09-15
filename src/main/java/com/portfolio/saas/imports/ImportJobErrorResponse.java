package com.portfolio.saas.imports;

public record ImportJobErrorResponse(
        String id,
        Long rowNumber,
        String errorMessage
) {
    public static ImportJobErrorResponse fromEntity(ImportJobError error) {
        return new ImportJobErrorResponse(
                error.getId(),
                error.getRowNumber(),
                error.getErrorMessage()
        );
    }
}
