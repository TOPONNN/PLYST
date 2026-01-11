package com.plyst;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class PlystApplication {
    public static void main(String[] args) {
        SpringApplication.run(PlystApplication.class, args);
    }
}
