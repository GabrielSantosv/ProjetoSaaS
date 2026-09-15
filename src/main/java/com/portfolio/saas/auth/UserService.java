package com.portfolio.saas.auth;

import com.portfolio.saas.auth.dto.TeamMemberResponse;

import java.util.List;

public interface UserService {

    List<TeamMemberResponse> getTeamMembers();
}
