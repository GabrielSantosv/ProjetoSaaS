package com.portfolio.saas.auth;

import com.portfolio.saas.auth.dto.TeamMemberResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Equipe", description = "Usuários do tenant autenticado")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @Operation(summary = "Listar equipe", description = "Retorna todos os usuários vinculados ao tenant autenticado")
    public ResponseEntity<List<TeamMemberResponse>> getTeamMembers() {
        return ResponseEntity.ok(userService.getTeamMembers());
    }
}
