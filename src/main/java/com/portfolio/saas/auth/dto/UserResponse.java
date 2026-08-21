package com.portfolio.saas.auth.dto;

import com.portfolio.saas.auth.Role;
import com.portfolio.saas.auth.User;
import com.portfolio.saas.auth.UserPrincipal;

public record UserResponse(
        String id,
        String tenantId,
        String name,
        String email,
        Role role
) {
    public static UserResponse fromUser(User user) {
        return new UserResponse(
                user.getId(),
                user.getTenantId(),
                user.getName(),
                user.getEmail(),
                user.getRole()
        );
    }

    public static UserResponse fromPrincipal(UserPrincipal principal) {
        return new UserResponse(
                principal.getId(),
                principal.getTenantId(),
                principal.getName(),
                principal.getEmail(),
                principal.getRole()
        );
    }
}
