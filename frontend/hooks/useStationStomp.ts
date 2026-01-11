import { useCallback, useEffect, useRef, useState } from "react";
import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { StationDetail, StationParticipant, StationPlayback, StationUserInfo } from "../services/api";

const API_BASE = (import.meta.env.VITE_API_URL || "https://plyst.info").replace(/\/$/, "");
const WS_STOMP_URL = `${API_BASE}/ws-stomp`;

export interface ChatMessage {
  id: string;
  user: StationUserInfo;
  message: string;
  sentAt: string;
}

export interface QueueItem {
  id: string;
  title: string;
  artist: string;
  albumImage?: string;
  duration?: number;
  videoId?: string;
}

export interface SubtitleSegment {
  startTime: number;
  endTime: number;
  text: string;
  originalLanguage: string;
  translatedText: string;
}

export interface SubtitleState {
  enabled: boolean;
  available: boolean;
  processing: boolean;
  originalLanguage: string;
  segments: SubtitleSegment[];
}

export interface StationStompCallbacks {
  onStationDetail?: (station: StationDetail, videoId?: string, queue?: QueueItem[], volume?: number, subtitleData?: { enabled: boolean; segments?: SubtitleSegment[]; language?: string }) => void;
  onParticipantsUpdate?: (participants: StationParticipant[], host?: StationUserInfo, status?: string, action?: string, affectedUserId?: number) => void;
  onPlaybackUpdate?: (playback: StationPlayback, videoId?: string, serverTime?: number, senderId?: number) => void;
  onChat?: (message: ChatMessage) => void;
  onKicked?: (reason?: string) => void;
  onStationClosed?: () => void;
  onVolumeUpdate?: (volume: number) => void;
  onQueueUpdate?: (queue: QueueItem[]) => void;
  onQueueAdd?: (item: QueueItem) => void;
  onHostChanged?: (newHostId: number, participants?: StationParticipant[], host?: StationUserInfo) => void;
  onSubtitleEnabled?: (videoId: string) => void;
  onSubtitleDisabled?: () => void;
  onSubtitleReady?: (data: { videoId: string; available: boolean; processing: boolean; originalLanguage: string; segments: SubtitleSegment[] }) => void;
  onSubtitleStatus?: (data: { enabled: boolean; available: boolean; processing: boolean; originalLanguage?: string; segments?: SubtitleSegment[] }) => void;
  onTitleChanged?: (title: string) => void;
}

export interface UseStationStompReturn {
  isConnected: boolean;
  sendPlaybackUpdate: (payload: StationPlayback & { videoId?: string }) => void;
  sendChat: (message: string) => void;
  requestSync: () => void;
  sendVolumeUpdate: (volume: number) => void;
  sendQueueUpdate: (queue: QueueItem[]) => void;
  sendQueueAdd: (item: QueueItem) => void;
  sendSubtitleEnable: (videoId?: string) => void;
  sendSubtitleDisable: () => void;
  sendSubtitleStatus: (videoId?: string) => void;
  disconnect: () => void;
}

export function useStationStomp(
  stationId: number,
  userId: number,
  callbacks: StationStompCallbacks
): UseStationStompReturn {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<StompSubscription | null>(null);
  const callbacksRef = useRef(callbacks);

  callbacksRef.current = callbacks;

  const handleMessage = useCallback((message: IMessage) => {
    try {
      const data = JSON.parse(message.body);
      const cb = callbacksRef.current;

      switch (data.type) {
        case "station_detail":
          if (data.station && cb.onStationDetail) {
            cb.onStationDetail(
              data.station,
              data.videoId,
              data.queue,
              data.volume,
              data.subtitleEnabled ? {
                enabled: true,
                segments: data.subtitleSegments,
                language: data.subtitleLanguage
              } : undefined
            );
          }
          break;

        case "participants_update":
          cb.onParticipantsUpdate?.(
            data.participants || [],
            data.host,
            data.status,
            data.action,
            data.affectedUserId
          );
          break;

        case "playback_update":
        case "playback_state":
          if (cb.onPlaybackUpdate) {
            const playbackData = data.payload || data;
            cb.onPlaybackUpdate(playbackData, data.videoId, data.serverTime, data.senderId);
          }
          break;

        case "chat":
          if (cb.onChat) {
            cb.onChat({
              id: `${Date.now()}-${Math.random()}`,
              user: data.user || { id: 0, nickname: "Unknown" },
              message: data.message,
              sentAt: data.sentAt || new Date().toISOString()
            });
          }
          break;

        case "kicked":
          cb.onKicked?.(data.reason);
          break;

        case "station_closed":
          cb.onStationClosed?.();
          break;

        case "volume_update":
          cb.onVolumeUpdate?.(data.volume ?? 100);
          break;

        case "queue_update":
          cb.onQueueUpdate?.(data.queue || []);
          break;

        case "queue_add":
          if (data.item) {
            cb.onQueueAdd?.(data.item);
          }
          break;

        case "host_changed":
          cb.onHostChanged?.(data.newHostId, data.participants, data.host);
          break;

        case "subtitle_enabled":
          cb.onSubtitleEnabled?.(data.videoId);
          break;

        case "subtitle_disabled":
          cb.onSubtitleDisabled?.();
          break;

        case "subtitle_ready":
          cb.onSubtitleReady?.({
            videoId: data.videoId,
            available: data.available,
            processing: data.processing,
            originalLanguage: data.originalLanguage || "",
            segments: data.segments || []
          });
          break;

        case "subtitle_status":
          cb.onSubtitleStatus?.({
            enabled: data.enabled,
            available: data.available,
            processing: data.processing,
            originalLanguage: data.originalLanguage,
            segments: data.segments
          });
          break;

        case "title_changed":
          cb.onTitleChanged?.(data.title);
          break;

        case "pong":
          break;

        default:
          console.debug("Unknown STOMP message type:", data.type);
      }
    } catch (error) {
      console.error("STOMP message parse error:", error);
    }
  }, []);

  useEffect(() => {
    if (!stationId || !userId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_STOMP_URL),
      connectHeaders: {
        userId: String(userId)
      },
      debug: (str) => {
        if (import.meta.env.DEV) {
          console.debug("[STOMP]", str);
        }
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    client.onConnect = () => {
      console.log("STOMP connected");
      setIsConnected(true);

      subscriptionRef.current = client.subscribe(
        `/topic/station/${stationId}`,
        handleMessage
      );

      client.subscribe(
        `/user/queue/station/${stationId}`,
        handleMessage
      );

      client.publish({
        destination: `/app/station/${stationId}/sync`,
        body: JSON.stringify({})
      });
    };

    client.onDisconnect = () => {
      console.log("STOMP disconnected");
      setIsConnected(false);
    };

    client.onStompError = (frame) => {
      console.error("STOMP error:", frame.headers["message"], frame.body);
    };

    client.activate();
    clientRef.current = client;

    return () => {
      subscriptionRef.current?.unsubscribe();
      client.deactivate();
      clientRef.current = null;
    };
  }, [stationId, userId, handleMessage]);

  const sendPlaybackUpdate = useCallback((payload: StationPlayback & { videoId?: string }) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/station/${stationId}/playback`,
      body: JSON.stringify({
        payload: {
          title: payload.title,
          artist: payload.artist,
          albumImage: payload.albumImage,
          durationSec: payload.durationSec,
          positionMs: payload.positionMs,
          isPlaying: payload.isPlaying
        },
        videoId: payload.videoId
      })
    });
  }, [stationId]);

  const sendChat = useCallback((message: string) => {
    if (!clientRef.current?.connected || !message.trim()) return;
    clientRef.current.publish({
      destination: `/app/station/${stationId}/chat`,
      body: JSON.stringify({ message: message.trim() })
    });
  }, [stationId]);

  const requestSync = useCallback(() => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/station/${stationId}/sync`,
      body: JSON.stringify({})
    });
  }, [stationId]);

  const sendVolumeUpdate = useCallback((volume: number) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/station/${stationId}/volume`,
      body: JSON.stringify({ volume })
    });
  }, [stationId]);

  const sendQueueUpdate = useCallback((queue: QueueItem[]) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/station/${stationId}/queue/update`,
      body: JSON.stringify({ queue })
    });
  }, [stationId]);

  const sendQueueAdd = useCallback((item: QueueItem) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/station/${stationId}/queue/add`,
      body: JSON.stringify({ item })
    });
  }, [stationId]);

  const sendSubtitleEnable = useCallback((videoId?: string) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/station/${stationId}/subtitle/enable`,
      body: JSON.stringify({ videoId })
    });
  }, [stationId]);

  const sendSubtitleDisable = useCallback(() => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/station/${stationId}/subtitle/disable`,
      body: JSON.stringify({})
    });
  }, [stationId]);

  const sendSubtitleStatus = useCallback((videoId?: string) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/station/${stationId}/subtitle/status`,
      body: JSON.stringify({ videoId })
    });
  }, [stationId]);

  const disconnect = useCallback(() => {
    clientRef.current?.deactivate();
  }, []);

  return {
    isConnected,
    sendPlaybackUpdate,
    sendChat,
    requestSync,
    sendVolumeUpdate,
    sendQueueUpdate,
    sendQueueAdd,
    sendSubtitleEnable,
    sendSubtitleDisable,
    sendSubtitleStatus,
    disconnect
  };
}
