# =============================================================================
# GRIFO API - TESTE DE CARGA EM PRODUÇÃO
# =============================================================================

Write-Host "=== INICIANDO TESTE DE CARGA DA API GRIFO ===" -ForegroundColor Green
Write-Host "Testando API em produção: https://grifo-api-backend.onrender.com" -ForegroundColor Yellow
Write-Host ""

# Configurações do teste de carga
$baseUrl = "https://grifo-api-backend.onrender.com"
$endpoints = @(
    @{ Name = "Health Check"; Url = "$baseUrl/health" },
    @{ Name = "API Root"; Url = "$baseUrl/" },
    @{ Name = "API Info"; Url = "$baseUrl/api" }
)

$concurrentRequests = 10
$totalRequests = 50
$timeout = 30

Write-Host "Configurações do teste:" -ForegroundColor Cyan
Write-Host "- Requisições simultâneas: $concurrentRequests" -ForegroundColor White
Write-Host "- Total de requisições: $totalRequests" -ForegroundColor White
Write-Host "- Timeout por requisição: $timeout segundos" -ForegroundColor White
Write-Host ""

# Função para fazer uma requisição
function Invoke-LoadTestRequest {
    param(
        [string]$Url,
        [int]$RequestId
    )
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $timeout -ErrorAction Stop
        $stopwatch.Stop()
        
        return @{
            RequestId = $RequestId
            Url = $Url
            StatusCode = $response.StatusCode
            ResponseTime = $stopwatch.ElapsedMilliseconds
            Success = $true
            Error = $null
            Timestamp = Get-Date
        }
    } catch {
        $stopwatch.Stop()
        
        return @{
            RequestId = $RequestId
            Url = $Url
            StatusCode = $null
            ResponseTime = $stopwatch.ElapsedMilliseconds
            Success = $false
            Error = $_.Exception.Message
            Timestamp = Get-Date
        }
    }
}

# Executar teste de carga para cada endpoint
foreach ($endpoint in $endpoints) {
    Write-Host "=== TESTANDO: $($endpoint.Name) ===" -ForegroundColor Green
    Write-Host "URL: $($endpoint.Url)" -ForegroundColor Gray
    Write-Host ""
    
    $results = @()
    $jobs = @()
    
    # Iniciar requisições em paralelo
    Write-Host "Iniciando $totalRequests requisições em lotes de $concurrentRequests..." -ForegroundColor Yellow
    
    $startTime = Get-Date
    
    for ($i = 1; $i -le $totalRequests; $i++) {
        # Limitar número de jobs simultâneos
        while ((Get-Job -State Running).Count -ge $concurrentRequests) {
            Start-Sleep -Milliseconds 100
        }
        
        $job = Start-Job -ScriptBlock {
            param($Url, $RequestId, $Timeout)
            
            try {
                $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
                $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $Timeout -ErrorAction Stop
                $stopwatch.Stop()
                
                return @{
                    RequestId = $RequestId
                    StatusCode = $response.StatusCode
                    ResponseTime = $stopwatch.ElapsedMilliseconds
                    Success = $true
                    Error = $null
                }
            } catch {
                $stopwatch.Stop()
                
                return @{
                    RequestId = $RequestId
                    StatusCode = $null
                    ResponseTime = $stopwatch.ElapsedMilliseconds
                    Success = $false
                    Error = $_.Exception.Message
                }
            }
        } -ArgumentList $endpoint.Url, $i, $timeout
        
        $jobs += $job
        
        # Mostrar progresso
        if ($i % 10 -eq 0) {
            Write-Host "Enviadas: $i/$totalRequests requisições" -ForegroundColor Cyan
        }
    }
    
    # Aguardar conclusão de todos os jobs
    Write-Host "Aguardando conclusão de todas as requisições..." -ForegroundColor Yellow
    
    $jobs | Wait-Job | Out-Null
    
    # Coletar resultados
    foreach ($job in $jobs) {
        $result = Receive-Job -Job $job
        if ($result) {
            $results += $result
        }
        Remove-Job -Job $job
    }
    
    $endTime = Get-Date
    $totalTime = ($endTime - $startTime).TotalSeconds
    
    # Análise dos resultados
    $successfulRequests = $results | Where-Object { $_.Success }
    $failedRequests = $results | Where-Object { -not $_.Success }
    
    $successCount = $successfulRequests.Count
    $failureCount = $failedRequests.Count
    $successRate = [math]::Round(($successCount / $totalRequests) * 100, 2)
    
    if ($successfulRequests.Count -gt 0) {
        $avgResponseTime = [math]::Round(($successfulRequests | Measure-Object -Property ResponseTime -Average).Average, 2)
        $minResponseTime = ($successfulRequests | Measure-Object -Property ResponseTime -Minimum).Minimum
        $maxResponseTime = ($successfulRequests | Measure-Object -Property ResponseTime -Maximum).Maximum
    } else {
        $avgResponseTime = 0
        $minResponseTime = 0
        $maxResponseTime = 0
    }
    
    $requestsPerSecond = [math]::Round($totalRequests / $totalTime, 2)
    
    # Exibir resultados
    Write-Host ""
    Write-Host "=== RESULTADOS: $($endpoint.Name) ===" -ForegroundColor Green
    Write-Host "Total de requisições: $totalRequests" -ForegroundColor White
    Write-Host "Requisições bem-sucedidas: $successCount" -ForegroundColor Green
    Write-Host "Requisições falhadas: $failureCount" -ForegroundColor Red
    Write-Host "Taxa de sucesso: $successRate%" -ForegroundColor $(if ($successRate -ge 95) { 'Green' } elseif ($successRate -ge 80) { 'Yellow' } else { 'Red' })
    Write-Host "Tempo total do teste: $([math]::Round($totalTime, 2)) segundos" -ForegroundColor White
    Write-Host "Requisições por segundo: $requestsPerSecond req/s" -ForegroundColor Cyan
    
    if ($successfulRequests.Count -gt 0) {
        Write-Host "Tempo de resposta médio: ${avgResponseTime}ms" -ForegroundColor Yellow
        Write-Host "Tempo de resposta mínimo: ${minResponseTime}ms" -ForegroundColor Green
        Write-Host "Tempo de resposta máximo: ${maxResponseTime}ms" -ForegroundColor Red
    }
    
    # Mostrar erros se houver
    if ($failedRequests.Count -gt 0) {
        Write-Host ""
        Write-Host "Erros encontrados:" -ForegroundColor Red
        $errorGroups = $failedRequests | Group-Object -Property Error
        foreach ($errorGroup in $errorGroups) {
            Write-Host "  - $($errorGroup.Name): $($errorGroup.Count) ocorrências" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "" -NoNewline
}

Write-Host "=== TESTE DE CARGA CONCLUÍDO ===" -ForegroundColor Green