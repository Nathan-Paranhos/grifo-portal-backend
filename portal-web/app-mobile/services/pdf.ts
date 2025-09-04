import { colors, typography } from '@/constants/colors';
import * as QRCode from 'qrcode';
import * as FileSystem from 'expo-file-system';
import { DraftVistoria, LocalPhoto } from '@/types';

export class PdfService {
  static async generatePdf(vistoria: DraftVistoria, imovelData: any): Promise<string> {
    try {
      // This is a simplified PDF generation
      // In a real implementation, you would use react-native-pdf-lib or similar
      
      const pdfContent = await this.buildPdfContent(vistoria, imovelData);
      const fileName = `vistoria_${vistoria.id}_${Date.now()}.pdf`;
      const pdfPath = `${FileSystem.documentDirectory}${fileName}`;
      
      // Generate QR Code for contestation using portal URL from environment
      const portalUrl = process.env.EXPO_PUBLIC_PORTAL_URL || 'https://fsvwifbvehdhlufauahj.supabase.co';
      const contestationUrl = `${portalUrl}/contest/${vistoria.id}`;
      const qrCodeData = await this.generateQRCode(contestationUrl);
      
      // Simulate PDF generation (replace with actual PDF library)
      await FileSystem.writeAsStringAsync(pdfPath, pdfContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      return pdfPath;
    } catch (error) {
      // Error generating PDF handled silently
      throw error;
    }
  }

  private static async buildPdfContent(vistoria: DraftVistoria, imovelData: any): Promise<string> {
    // This would be replaced with actual PDF generation using pdf library
    let content = `RELATÓRIO DE VISTORIA\n\n`;
    content += `Imóvel: ${imovelData.endereco}\n`;
    content += `Código: ${imovelData.codigo}\n`;
    content += `Tipo: ${vistoria.tipo.toUpperCase()}\n`;
    content += `Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    
    vistoria.ambientes.forEach((ambiente) => {
      content += `\n--- ${ambiente.nome.toUpperCase()} ---\n`;
      content += `Comentário: ${ambiente.comentario}\n`;
      content += `Fotos: ${ambiente.fotos.length}\n`;
    });
    
    return content;
  }

  private static async generateQRCode(url: string): Promise<string> {
    try {
      // Generate QR code using the library
      const qrCode = await QRCode.toString(url, {
        type: 'svg',
        width: 200,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      return qrCode;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  }

  static async getDocumentSize(uri: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return (fileInfo.exists && 'size' in fileInfo) ? fileInfo.size : 0;
    } catch (error) {
      console.error('Error getting document size:', error);
      return 0;
    }
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}