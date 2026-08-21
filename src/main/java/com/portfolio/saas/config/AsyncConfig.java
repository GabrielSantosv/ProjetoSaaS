package com.portfolio.saas.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.SimpleAsyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.EnableAsync;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Executor assíncrono padrão do Spring configurado com Java 21 Virtual Threads.
     */
    @Bean(name = "taskExecutor")
    public TaskExecutor taskExecutor() {
        SimpleAsyncTaskExecutor executor = new SimpleAsyncTaskExecutor("saas-virtual-async-");
        executor.setVirtualThreads(true);
        return executor;
    }

    /**
     * Executor dedicado de Virtual Threads para processamento de tarefas em lote / importação massiva.
     */
    @Bean(name = "virtualThreadPerTaskExecutor")
    public ExecutorService virtualThreadPerTaskExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}
