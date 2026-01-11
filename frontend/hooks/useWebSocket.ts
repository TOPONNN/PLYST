import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'wss://plyst.info/ws';

export interface NotificationData {
  id: number;
  type: 'like' | 'comment' | 'follow' | 'playlist' | 'ai';
  title: string;
  message: string;
  avatar: string;
  isRead: boolean;
  relatedId?: number;
  time: string;
  createdAt: string;
}

export interface BroadcastPlaylistData {
  id: number;
  title: string;
  description: string;
  coverImageUrl?: string;
  isPublic: boolean;
  viewCount: number;
  likeCount: number;
  owner: { id: number; nickname: string };
  trackCount: number;
  tags: string[];
  createdAt: string;
  tracks: { id: number; title: string; artist: string; albumImage?: string; durationSec: number }[];
}

export interface BroadcastCommentData {
  id: number;
  content: string;
  author: { id: number; nickname: string; avatar?: string };
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
}

export interface BroadcastEvent {
  type: 'playlist_created' | 'playlist_deleted' | 'playlist_updated' | 'comment_added' | 'comment_deleted' | 'share_updated' | 'view_updated' | 'visibility_updated';
  playlist?: BroadcastPlaylistData;
  playlistId?: number;
  comment?: BroadcastCommentData;
  id?: number;
  shareCount?: number;
  viewCount?: number;
  isPublic?: boolean;
  title?: string;
  description?: string;
  coverImageUrl?: string;
  tags?: string[];
}

interface WebSocketMessage {
  type: 'new_notification' | 'connected' | 'playlist_created' | 'playlist_deleted' | 'playlist_updated' | 'comment_added' | 'comment_deleted' | 'share_updated' | 'view_updated' | 'visibility_updated';
  notification?: NotificationData;
  message?: string;
  playlist?: BroadcastPlaylistData;
  playlistId?: number;
  comment?: BroadcastCommentData;
  id?: number;
  shareCount?: number;
  viewCount?: number;
  isPublic?: boolean;
}

interface UseWebSocketReturn {
  notifications: NotificationData[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (notificationId: number) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: number) => void;
  clearAll: () => void;
  refetch: () => Promise<void>;
}

interface UseWebSocketOptions {
  onNewNotification?: (notification: NotificationData) => void;
  onBroadcast?: (event: BroadcastEvent) => void;
}

export function useWebSocket(
  userId: number | null,
  options?: UseWebSocketOptions
): UseWebSocketReturn {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNewNotificationRef = useRef(options?.onNewNotification);
  const onBroadcastRef = useRef(options?.onBroadcast);
  
  useEffect(() => {
    onNewNotificationRef.current = options?.onNewNotification;
    onBroadcastRef.current = options?.onBroadcast;
  }, [options?.onNewNotification, options?.onBroadcast]);

  const API_URL = 'https://plyst.info';

  // 알림 목록 가져오기
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`${API_URL}/api/notifications/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('알림 목록 조회 실패:', error);
    }
  }, [userId]);

  // WebSocket 연결
  const connect = useCallback(() => {
    // 이미 연결 중이거나 연결됨 상태면 무시
    if (!userId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // 기존 연결이 있으면 먼저 정리
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`${WS_URL}?userId=${userId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket 연결됨');
      setIsConnected(true);
      // 연결 시 기존 알림 목록 가져오기
      fetchNotifications();
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        
        if (data.type === 'new_notification' && data.notification) {
          setNotifications(prev => [data.notification!, ...prev]);
          
          if (onNewNotificationRef.current) {
            onNewNotificationRef.current(data.notification);
          }
        } else if (['playlist_created', 'playlist_deleted', 'playlist_updated', 'comment_added', 'comment_deleted', 'share_updated', 'view_updated', 'visibility_updated'].includes(data.type)) {
          if (onBroadcastRef.current) {
            onBroadcastRef.current({
              type: data.type as BroadcastEvent['type'],
              playlist: data.playlist,
              playlistId: data.playlistId,
              comment: data.comment,
              id: data.id,
              shareCount: data.shareCount,
              viewCount: data.viewCount,
              isPublic: data.isPublic
            });
          }
        }
      } catch (error) {
        console.error('WebSocket 메시지 파싱 오류:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket 연결 종료', event.code);
      setIsConnected(false);
      wsRef.current = null;
      
      // 정상 종료(1000)나 GOING_AWAY(1001)가 아닌 경우만 재연결
      if (event.code !== 1000 && event.code !== 1001) {
        // 5초 후 재연결 시도
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };

    ws.onerror = () => {
      // 에러 로그는 onclose에서 처리되므로 여기서는 무시
    };
  }, [userId, fetchNotifications]);

  // userId가 변경되면 연결
  useEffect(() => {
    if (userId) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [userId, connect]);

  // 알림 읽음 처리
  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PATCH'
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('알림 읽음 처리 실패:', error);
    }
  }, []);

  // 모든 알림 읽음 처리
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    
    try {
      await fetch(`${API_URL}/api/notifications/${userId}/read-all`, {
        method: 'PATCH'
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('모든 알림 읽음 처리 실패:', error);
    }
  }, [userId]);

  // 알림 삭제
  const deleteNotification = useCallback(async (notificationId: number) => {
    try {
      await fetch(`${API_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('알림 삭제 실패:', error);
    }
  }, []);

  // 모든 알림 삭제
  const clearAll = useCallback(async () => {
    if (!userId) return;
    
    try {
      await fetch(`${API_URL}/api/notifications/user/${userId}`, {
        method: 'DELETE'
      });
      setNotifications([]);
    } catch (error) {
      console.error('모든 알림 삭제 실패:', error);
    }
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refetch: fetchNotifications
  };
}
