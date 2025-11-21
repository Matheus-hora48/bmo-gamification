import admin from "firebase-admin";
import { logger } from "../utils/logger";

export enum PushType {
  GROUP_INVITE = 1,
  GROUP_REMOVE = 4,
  NEWS_GENERAL = 5,
  NEWS_UPDATE = 20,
  ACHIEVEMENT = 12,
  STUDY_REMINDER = 30,
}

export interface NotificationPayload {
  title: string;
  body: string;
  pushType: PushType;
  additionalData?: Record<string, string>;
}

export class NotificationService {
  /**
   * Envia uma notificação push para um dispositivo específico via FCM.
   *
   * @param fcmToken Token FCM do dispositivo do usuário
   * @param payload Dados da notificação (título, corpo, tipo, dados extras)
   */
  async sendPushNotification(
    fcmToken: string,
    payload: NotificationPayload
  ): Promise<string | null> {
    if (!fcmToken) {
      logger.warn("Tentativa de enviar notificação sem token FCM.");
      return null;
    }

    const { title, body, pushType, additionalData = {} } = payload;

    const message: admin.messaging.Message = {
      token: fcmToken,
      // 'notification' garante que apareça na bandeja do sistema quando o app está em background/terminado
      notification: {
        title: title,
        body: body,
      },
      // 'data' é processado pelo aplicativo quando aberto ou em foreground
      data: {
        title: title,
        message: body,
        push_type: String(pushType), // Enviar como string
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        ...additionalData,
      },
      // Configurações específicas para Android
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "BMO_channel", // Deve corresponder ao canal configurado no Flutter
        },
      },
      // Configurações específicas para iOS
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().send(message);
      logger.info(`Notificação enviada com sucesso: ${response}`, {
        pushType,
        title,
      });
      return response;
    } catch (error) {
      logger.error("Erro ao enviar notificação push:", {
        error: error instanceof Error ? error.message : String(error),
        fcmToken: fcmToken.substring(0, 10) + "...", // Log parcial por segurança
      });
      return null;
    }
  }

  /**
   * Envia uma notificação push para múltiplos dispositivos (Broadcast).
   * Processa em lotes de 500 tokens (limite do FCM).
   */
  async sendBroadcastNotification(
    tokens: string[],
    payload: NotificationPayload
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!tokens.length) {
      return { successCount: 0, failureCount: 0 };
    }

    const { title, body, pushType, additionalData = {} } = payload;
    const BATCH_SIZE = 500;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batchTokens = tokens.slice(i, i + BATCH_SIZE);

      const message: admin.messaging.MulticastMessage = {
        tokens: batchTokens,
        notification: {
          title,
          body,
        },
        data: {
          title,
          message: body,
          push_type: String(pushType),
          click_action: "FLUTTER_NOTIFICATION_CLICK",
          ...additionalData,
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "BMO_channel",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      };

      try {
        const response = await admin.messaging().sendEachForMulticast(message);
        successCount += response.successCount;
        failureCount += response.failureCount;

        if (response.failureCount > 0) {
          logger.warn(
            `Falha ao enviar para ${response.failureCount} tokens no lote de broadcast.`
          );
        }
      } catch (error) {
        logger.error("Erro ao enviar broadcast batch:", {
          error: error instanceof Error ? error.message : String(error),
        });
        failureCount += batchTokens.length;
      }
    }

    return { successCount, failureCount };
  }
}
