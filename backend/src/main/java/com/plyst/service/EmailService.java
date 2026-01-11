package com.plyst.service;

import com.plyst.entity.EmailVerification;
import com.plyst.repository.EmailVerificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {
    
    private final JavaMailSender mailSender;
    private final EmailVerificationRepository emailVerificationRepository;
    
    private static final int CODE_LENGTH = 6;
    private static final int CODE_EXPIRY_MINUTES = 10;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    
    @Transactional
    public String sendVerificationCode(String email, String purpose) {
        emailVerificationRepository.deleteUnverifiedByEmail(email);
        
        String code = generateVerificationCode();
        
        EmailVerification verification = EmailVerification.builder()
                .email(email)
                .code(code)
                .expiresAt(LocalDateTime.now().plusMinutes(CODE_EXPIRY_MINUTES))
                .build();
        
        emailVerificationRepository.save(verification);
        
        String subject = getEmailSubject(purpose);
        String content = getEmailContent(code, purpose);
        
        sendEmail(email, subject, content);
        
        return code;
    }
    
    @Transactional
    public boolean verifyCode(String email, String code) {
        return emailVerificationRepository.findValidVerification(
                email, code, LocalDateTime.now()
        ).map(verification -> {
            verification.setVerifiedAt(LocalDateTime.now());
            emailVerificationRepository.save(verification);
            return true;
        }).orElse(false);
    }
    
    @Transactional(readOnly = true)
    public boolean isVerified(String email) {
        return emailVerificationRepository.findTopByEmailOrderByIdDesc(email)
                .map(verification -> verification.getVerifiedAt() != null 
                        && verification.getExpiresAt().plusMinutes(5).isAfter(LocalDateTime.now()))
                .orElse(false);
    }
    
    @Transactional
    public void cleanupExpiredVerifications() {
        emailVerificationRepository.deleteExpiredVerifications(LocalDateTime.now());
    }
    
    private String generateVerificationCode() {
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(SECURE_RANDOM.nextInt(10));
        }
        return code.toString();
    }
    
    private String getEmailSubject(String purpose) {
        return switch (purpose) {
            case "FIND_ID" -> "[PLYST] 아이디 찾기 인증번호";
            case "RESET_PASSWORD" -> "[PLYST] 비밀번호 재설정 인증번호";
            default -> "[PLYST] 이메일 인증번호";
        };
    }
    
    private String getEmailContent(String code, String purpose) {
        String purposeText = switch (purpose) {
            case "FIND_ID" -> "아이디 찾기";
            case "RESET_PASSWORD" -> "비밀번호 재설정";
            default -> "이메일 인증";
        };
        
        return String.format("""
                안녕하세요, PLYST입니다.
                
                %s를 위한 인증번호입니다.
                
                인증번호: %s
                
                이 인증번호는 %d분간 유효합니다.
                본인이 요청하지 않은 경우 이 메일을 무시하세요.
                
                감사합니다.
                PLYST 팀
                """, purposeText, code, CODE_EXPIRY_MINUTES);
    }
    
    private void sendEmail(String to, String subject, String content) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(content);
            mailSender.send(message);
            log.info("Email sent to: {}", to);
        } catch (Exception e) {
            log.error("Failed to send email to: {}", to, e);
            throw new RuntimeException("이메일 발송에 실패했습니다.", e);
        }
    }
}
