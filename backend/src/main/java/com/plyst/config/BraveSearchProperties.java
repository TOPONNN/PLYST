package com.plyst.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.Setter;

@Component
@ConfigurationProperties(prefix = "brave.search")
@Getter
@Setter
public class BraveSearchProperties {
    private String apiKey;
}
