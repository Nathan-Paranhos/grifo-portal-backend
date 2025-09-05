import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { colors, typography, spacing } from '@/constants/colors';
import { Card } from '@/components/ui/Card';
import { OfflineService } from '@/services/offline';
import grifoApiService from '@/services/grifoApi';
import NetInfo from '@react-native-community/netinfo';

const screenWidth = Dimensions.get('window').width;

interface ReportData {
  totalVistorias: number;
  vistoriasPendentes: number;
  vistoriasFinalizadas: number;
  vistoriasEmAndamento: number;
  mediaTempoVistoria: number;
  fotosCapturadas: number;
  assinaturasColetadas: number;
  dadosSincronizados: number;
  ultimaAtualizacao: string;
}

interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }[];
}

interface PieChartData {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

export const MobileReports: React.FC = () => {
  const [reportData, setReportData] = useState<ReportData>({
    totalVistorias: 0,
    vistoriasPendentes: 0,
    vistoriasFinalizadas: 0,
    vistoriasEmAndamento: 0,
    mediaTempoVistoria: 0,
    fotosCapturadas: 0,
    assinaturasColetadas: 0,
    dadosSincronizados: 0,
    ultimaAtualizacao: '',
  });

  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChart, setSelectedChart] = useState<'line' | 'bar' | 'pie'>('bar');
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState<string>('');

  useEffect(() => {
    loadReportData();
    checkNetworkStatus();

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected || false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Verificar status da rede
   */
  const checkNetworkStatus = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      setIsOnline(netInfo.isConnected || false);
    } catch (error) {
      console.error('Error checking network status:', error);
    }
  };

  /**
   * Carregar dados do relatório
   */
  const loadReportData = async () => {
    try {
      setLoading(true);

      // Tentar carregar dados online primeiro
      if (isOnline) {
        try {
          const onlineData = await loadOnlineReportData();
          setReportData(onlineData);
          // Salvar dados offline para cache
          await OfflineService.saveReportData(onlineData);
        } catch (error) {
          console.warn('Failed to load online data, falling back to offline:', error);
          const offlineData = await loadOfflineReportData();
          setReportData(offlineData);
        }
      } else {
        // Carregar dados offline
        const offlineData = await loadOfflineReportData();
        setReportData(offlineData);
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do relatório');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Carregar dados online
   */
  const loadOnlineReportData = async (): Promise<ReportData> => {
    try {
      // Simular chamada para API
      const response = await grifoApiService.get('/reports/mobile-summary');
      return {
        totalVistorias: response.data.total_vistorias || 0,
        vistoriasPendentes: response.data.vistorias_pendentes || 0,
        vistoriasFinalizadas: response.data.vistorias_finalizadas || 0,
        vistoriasEmAndamento: response.data.vistorias_em_andamento || 0,
        mediaTempoVistoria: response.data.media_tempo_vistoria || 0,
        fotosCapturadas: response.data.fotos_capturadas || 0,
        assinaturasColetadas: response.data.assinaturas_coletadas || 0,
        dadosSincronizados: response.data.dados_sincronizados || 0,
        ultimaAtualizacao: new Date().toISOString(),
      };
    } catch (error) {
      // Se a API não existir ainda, retornar dados simulados
      return generateMockData();
    }
  };

  /**
   * Carregar dados offline
   */
  const loadOfflineReportData = async (): Promise<ReportData> => {
    try {
      // Tentar carregar dados salvos
      const savedData = await OfflineService.getReportData();
      if (savedData) {
        return savedData;
      }

      // Se não houver dados salvos, gerar dados baseados no armazenamento local
      const localStats = await OfflineService.getLocalStats();
      return {
        totalVistorias: localStats.totalVistorias || 0,
        vistoriasPendentes: localStats.vistoriasPendentes || 0,
        vistoriasFinalizadas: localStats.vistoriasFinalizadas || 0,
        vistoriasEmAndamento: localStats.vistoriasEmAndamento || 0,
        mediaTempoVistoria: localStats.mediaTempoVistoria || 0,
        fotosCapturadas: localStats.fotosCapturadas || 0,
        assinaturasColetadas: localStats.assinaturasColetadas || 0,
        dadosSincronizados: localStats.dadosSincronizados || 0,
        ultimaAtualizacao: localStats.ultimaAtualizacao || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error loading offline data:', error);
      return generateMockData();
    }
  };

  /**
   * Gerar dados simulados para demonstração
   */
  const generateMockData = (): ReportData => {
    return {
      totalVistorias: 45,
      vistoriasPendentes: 8,
      vistoriasFinalizadas: 32,
      vistoriasEmAndamento: 5,
      mediaTempoVistoria: 85, // minutos
      fotosCapturadas: 234,
      assinaturasColetadas: 28,
      dadosSincronizados: 95, // porcentagem
      ultimaAtualizacao: new Date().toISOString(),
    };
  };

  /**
   * Atualizar dados
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  /**
   * Preparar dados para gráfico de barras
   */
  const getBarChartData = (): ChartData => {
    return {
      labels: ['Pendentes', 'Em Andamento', 'Finalizadas'],
      datasets: [
        {
          data: [
            reportData.vistoriasPendentes,
            reportData.vistoriasEmAndamento,
            reportData.vistoriasFinalizadas,
          ],
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        },
      ],
    };
  };

  /**
   * Preparar dados para gráfico de pizza
   */
  const getPieChartData = (): PieChartData[] => {
    return [
      {
        name: 'Finalizadas',
        population: reportData.vistoriasFinalizadas,
        color: '#10b981',
        legendFontColor: '#374151',
        legendFontSize: 12,
      },
      {
        name: 'Em Andamento',
        population: reportData.vistoriasEmAndamento,
        color: '#f59e0b',
        legendFontColor: '#374151',
        legendFontSize: 12,
      },
      {
        name: 'Pendentes',
        population: reportData.vistoriasPendentes,
        color: '#ef4444',
        legendFontColor: '#374151',
        legendFontSize: 12,
      },
    ];
  };

  /**
   * Preparar dados para gráfico de linha (últimos 7 dias)
   */
  const getLineChartData = (): ChartData => {
    // Dados simulados para os últimos 7 dias
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const data = [3, 5, 2, 8, 6, 4, 7]; // Vistorias por dia

    return {
      labels,
      datasets: [
        {
          data,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  /**
   * Mostrar detalhes em modal
   */
  const showDetails = (title: string, content: string) => {
    setModalContent(`${title}\n\n${content}`);
    setShowModal(true);
  };

  /**
   * Formatar tempo em minutos para horas e minutos
   */
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  /**
   * Renderizar cartão de métrica
   */
  const renderMetricCard = (
    title: string,
    value: string | number,
    icon: string,
    color: string,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={[styles.metricCard, { borderLeftColor: color }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.metricHeader}>
        <Ionicons name={icon as any} size={24} color={color} />
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </TouchableOpacity>
  );

  /**
   * Renderizar seletor de gráfico
   */
  const renderChartSelector = () => (
    <View style={styles.chartSelector}>
      <TouchableOpacity
        style={[styles.chartButton, selectedChart === 'bar' && styles.chartButtonActive]}
        onPress={() => setSelectedChart('bar')}
      >
        <Ionicons name="bar-chart-outline" size={20} color={selectedChart === 'bar' ? '#fff' : '#6b7280'} />
        <Text style={[styles.chartButtonText, selectedChart === 'bar' && styles.chartButtonTextActive]}>
          Barras
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.chartButton, selectedChart === 'pie' && styles.chartButtonActive]}
        onPress={() => setSelectedChart('pie')}
      >
        <Ionicons name="pie-chart-outline" size={20} color={selectedChart === 'pie' ? '#fff' : '#6b7280'} />
        <Text style={[styles.chartButtonText, selectedChart === 'pie' && styles.chartButtonTextActive]}>
          Pizza
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.chartButton, selectedChart === 'line' && styles.chartButtonActive]}
        onPress={() => setSelectedChart('line')}
      >
        <Ionicons name="trending-up-outline" size={20} color={selectedChart === 'line' ? '#fff' : '#6b7280'} />
        <Text style={[styles.chartButtonText, selectedChart === 'line' && styles.chartButtonTextActive]}>
          Linha
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Renderizar gráfico selecionado
   */
  const renderChart = () => {
    const chartConfig = {
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: '#ffffff',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
      style: {
        borderRadius: 16,
      },
      propsForDots: {
        r: '6',
        strokeWidth: '2',
        stroke: '#3b82f6',
      },
    };

    switch (selectedChart) {
      case 'bar':
        return (
          <BarChart
            data={getBarChartData()}
            width={screenWidth - 64}
            height={220}
            chartConfig={chartConfig}
            verticalLabelRotation={0}
            style={styles.chart}
          />
        );
      case 'pie':
        return (
          <PieChart
            data={getPieChartData()}
            width={screenWidth - 64}
            height={220}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            style={styles.chart}
          />
        );
      case 'line':
        return (
          <LineChart
            data={getLineChartData()}
            width={screenWidth - 64}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="analytics-outline" size={48} color={colors.primary} />
        <Text style={styles.loadingText}>Carregando relatórios...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="analytics-outline" size={24} color={colors.primary} />
          <Text style={styles.headerTitle}>Relatórios Mobile</Text>
        </View>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10b981' : '#f59e0b' }]} />
          <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
      </View>

      {/* Métricas Principais */}
      <View style={styles.metricsGrid}>
        {renderMetricCard(
          'Total de Vistorias',
          reportData.totalVistorias,
          'document-text-outline',
          '#3b82f6',
          () => showDetails('Total de Vistorias', `${reportData.totalVistorias} vistorias registradas no sistema`)
        )}
        
        {renderMetricCard(
          'Finalizadas',
          reportData.vistoriasFinalizadas,
          'checkmark-circle-outline',
          '#10b981',
          () => showDetails('Vistorias Finalizadas', `${reportData.vistoriasFinalizadas} vistorias foram concluídas com sucesso`)
        )}
        
        {renderMetricCard(
          'Em Andamento',
          reportData.vistoriasEmAndamento,
          'time-outline',
          '#f59e0b',
          () => showDetails('Vistorias em Andamento', `${reportData.vistoriasEmAndamento} vistorias estão sendo executadas`)
        )}
        
        {renderMetricCard(
          'Pendentes',
          reportData.vistoriasPendentes,
          'hourglass-outline',
          '#ef4444',
          () => showDetails('Vistorias Pendentes', `${reportData.vistoriasPendentes} vistorias aguardando execução`)
        )}
      </View>

      {/* Métricas Secundárias */}
      <View style={styles.secondaryMetrics}>
        {renderMetricCard(
          'Tempo Médio',
          formatTime(reportData.mediaTempoVistoria),
          'stopwatch-outline',
          '#8b5cf6'
        )}
        
        {renderMetricCard(
          'Fotos Capturadas',
          reportData.fotosCapturadas,
          'camera-outline',
          '#06b6d4'
        )}
        
        {renderMetricCard(
          'Assinaturas',
          reportData.assinaturasColetadas,
          'create-outline',
          '#84cc16'
        )}
        
        {renderMetricCard(
          'Sincronização',
          `${reportData.dadosSincronizados}%`,
          'sync-outline',
          '#f97316'
        )}
      </View>

      {/* Gráficos */}
      <Card style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Distribuição de Vistorias</Text>
          <Text style={styles.chartSubtitle}>
            Última atualização: {new Date(reportData.ultimaAtualizacao).toLocaleString('pt-BR')}
          </Text>
        </View>
        
        {renderChartSelector()}
        {renderChart()}
      </Card>

      {/* Modal de Detalhes */}
      <Modal
        visible={showModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>{modalContent}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#6b7280',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  secondaryMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  chartContainer: {
    margin: 16,
    padding: 16,
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  chartSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
  },
  chartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  chartButtonActive: {
    backgroundColor: '#3b82f6',
  },
  chartButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  chartButtonTextActive: {
    color: '#fff',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    margin: 32,
    maxWidth: '90%',
  },
  modalText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});