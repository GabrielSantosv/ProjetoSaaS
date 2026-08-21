package com.portfolio.saas.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /**
     * Verificação global de existência de e-mail (bypassa o discriminador @TenantId).
     */
    @Query(value = "SELECT COUNT(*) FROM users WHERE email = :email", nativeQuery = true)
    long countByEmailGlobal(@Param("email") String email);

    default boolean existsByEmailGlobal(String email) {
        return countByEmailGlobal(email) > 0;
    }

    /**
     * Consulta nativa para autenticação de login (quando ainda não há JWT/TenantContext ativo).
     */
    @Query(value = "SELECT * FROM users WHERE email = :email LIMIT 1", nativeQuery = true)
    Optional<User> findByEmailForLogin(@Param("email") String email);
}
