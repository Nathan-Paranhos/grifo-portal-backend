# =============================================================================
# GRIFO API - TESTE DE PERFORMANCE EM PRODUÇÃO
# =============================================================================

Write-Host "=== INICIANDO TESTES DE PERFORMANCE DA API GRIFO ===" -ForegroundColor Green
Write-Host "Testando API em produção: https://grifo-api-backend.onrender.com" -ForegroundColor Yellow
Write-Host ""

# Configurações
$baseUrl = "https://grifo-api-backend.onrender.com"
$timeout = 60
$results = @()

# Função para testar endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    
    Write-Host "Testando: $Name" -ForegroundColor Cyan
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        $params = @{
            Uri = $Url
            Method = $Method
            TimeoutSec = $timeout
        }
        
        if ($Headers.Count -gt 0) {
            $params.Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = $Body
        }
        
        $response = Invoke-WebRequest @params
        $stopwatch.Stop()
        
        $result = @{
            Name = $Name
            Url = $Url
            Method = $Method
            StatusCode = $response.StatusCode
            ResponseTime = $stopwatch.ElapsedMilliseconds
            Success = $true
            Error = $null
        }
        
        Write-Host "  ✅ Status: $($response.StatusCode) | Tempo: $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Green
        
    } catch {
        $stopwatch.Stop()
        
        $result = @{
            Name = $Name
            Url = $Url
            Method = $Method
            StatusCode = $null
            ResponseTime = $stopwatch.ElapsedMilliseconds
            Success = $false
            Error = $_.Exception.Message
        }
        
        Write-Host "  ❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    return $result
}

Write-Host "Iniciando testes..." -ForegroundColor Yellow
Write-Host ""

# Teste 1: Endpoint raiz
$results += Test-Endpoint -Name "API Root" -Url "$baseUrl/"

# Teste 2: Health check
$results += Test-Endpoint -Name "Health Check" -Url "$baseUrl/health"

# Teste 3: API Info
$results += Test-Endpoint -Name "API Info" -Url "$baseUrl/api"

# Teste 4: Documentação Swagger
$results += Test-Endpoint -Name "Swagger Docs" -Url "$baseUrl/functions/v1/docs"

# Teste 5: GraphQL endpoint
$results += Test-Endpoint -Name "GraphQL" -Url "$baseUrl/graphql/v1"

Write-Host ""
Write-Host "=== RESUMO DOS TESTES ===" -ForegroundColor Green
Write-Host ""

$successCount = ($results | Where-Object { $_.Success }).Count
$totalCount = $results.Count
$avgResponseTime = ($results | Where-Object { $_.Success } | Measure-Object -Property ResponseTime -Average).Average

Write-Host "Total de testes: $totalCount" -ForegroundColor White
Write-Host "Sucessos: $successCount" -ForegroundColor Green
Write-Host "Falhas: $($totalCount - $successCount)" -ForegroundColor Red
Write-Host "Tempo médio de resposta: $([math]::Round($avgResponseTime, 2))ms" -ForegroundColor Yellow
Write-Host ""

# Detalhes dos resultados
Write-Host "=== DETALHES DOS RESULTADOS ===" -ForegroundColor Green
foreach ($result in $results) {
    $status = if ($result.Success) { "✅" } else { "❌" }
    $time = if ($result.ResponseTime) { "$($result.ResponseTime)ms" } else { "N/A" }
    $code = if ($result.StatusCode) { $result.StatusCode } else { "ERROR" }
    
    Write-Host "$status $($result.Name): $code | $time" -ForegroundColor White
    if (-not $result.Success) {
        Write-Host "   Erro: $($result.Error)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== ANÁLISE DE PERFORMANCE ===" -ForegroundColor Green

if ($avgResponseTime -lt 500) {
    Write-Host "🚀 Performance EXCELENTE (< 500ms)" -ForegroundColor Green
} elseif ($avgResponseTime -lt 1000) {
    Write-Host "⚡ Performance BOA (500-1000ms)" -ForegroundColor Yellow
} elseif ($avgResponseTime -lt 2000) {
    Write-Host "⚠️  Performance REGULAR (1-2s)" -ForegroundColor Orange
} else {
    Write-Host "🐌 Performance LENTA (> 2s)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TESTE DE PERFORMANCE CONCLUÍDO ===" -ForegroundColor Green