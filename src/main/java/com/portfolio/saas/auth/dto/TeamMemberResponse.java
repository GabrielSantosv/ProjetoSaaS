package com.portfolio.saas.auth.dto;

import com.portfolio.saas.auth.Role;
import com.portfolio.saas.auth.User;

public record TeamMemberResponse(
        String id,
        String name,
        String email,
        Role role,
        String status
) {
    public static TeamMemberResponse fromUser(User user) {
        // Não existe estado "convite pendente" no modelo atual: um User só existe depois
        // de já ter senha definida, então o único status real possível é ativo.
        return new TeamMemberResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                "ACTIVE"
        );
    }
}
