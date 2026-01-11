package com.plyst.repository;

import com.plyst.entity.OAuthAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OAuthAccountRepository extends JpaRepository<OAuthAccount, Integer> {
    
    List<OAuthAccount> findByUserId(Integer userId);
    
    Optional<OAuthAccount> findByProviderAndProviderUserId(String provider, String providerUserId);
    
    Optional<OAuthAccount> findByUserIdAndProvider(Integer userId, String provider);
    
    boolean existsByProviderAndProviderUserId(String provider, String providerUserId);
    
    boolean existsByUserIdAndProvider(Integer userId, String provider);
    
    @Modifying
    @Query("DELETE FROM OAuthAccount o WHERE o.user.id = :userId AND o.provider = :provider")
    void deleteByUserIdAndProvider(@Param("userId") Integer userId, @Param("provider") String provider);
    
    @Modifying
    @Query("DELETE FROM OAuthAccount o WHERE o.user.id = :userId")
    void deleteByUserId(@Param("userId") Integer userId);
}
