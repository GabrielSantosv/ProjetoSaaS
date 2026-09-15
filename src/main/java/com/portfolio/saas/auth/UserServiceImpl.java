package com.portfolio.saas.auth;

import com.portfolio.saas.auth.dto.TeamMemberResponse;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;

    public UserServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeamMemberResponse> getTeamMembers() {
        return userRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(TeamMemberResponse::fromUser)
                .toList();
    }
}
