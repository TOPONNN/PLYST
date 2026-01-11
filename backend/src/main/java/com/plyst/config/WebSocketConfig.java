package com.plyst.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.plyst.service.WebSocketHandler;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
@SuppressWarnings("null")
public class WebSocketConfig implements WebSocketConfigurer {
    
    private final WebSocketHandler webSocketHandler;
    
    private static final String[] ALLOWED_ORIGINS = {
        "https://plyst.info", 
        "http://plyst.info", 
        "http://52.78.220.83", 
        "http://localhost:3000"
    };
    
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(webSocketHandler, "/ws")
                .setAllowedOrigins(ALLOWED_ORIGINS);
    }
}
