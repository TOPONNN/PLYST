import { useState, useCallback } from 'react';
import { searchPlaylists, getPlaylistTracks, getYoutubeVideoId, Playlist, Track } from '../services/api';

export interface TrackWithVideo extends Track {
  videoId?: string;
}

export function useSpotifySearch() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tracks, setTracks] = useState<TrackWithVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);

  // 플레이리스트 검색
  const searchPlaylistsByKeyword = useCallback(async (keyword: string, loadMore: boolean = false) => {
    if (!keyword.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const offset = loadMore ? currentOffset + 1 : 0;
      const results = await searchPlaylists(keyword, offset);
      
      if (loadMore) {
        setPlaylists(prev => [...prev, ...results]);
      } else {
        setPlaylists(results);
      }
      setCurrentOffset(offset);
    } catch (err) {
      setError('플레이리스트 검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [currentOffset]);

  // 플레이리스트의 트랙 로드
  const loadPlaylistTracks = useCallback(async (playlistId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const trackList = await getPlaylistTracks(playlistId);
      setTracks(trackList);
      return trackList;
    } catch (err) {
      setError('트랙을 불러오는데 실패했습니다.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 특정 트랙의 YouTube 비디오 ID 가져오기
  const getVideoId = useCallback(async (track: Track): Promise<string> => {
    try {
      const videoId = await getYoutubeVideoId(track.title, track.artists);
      return videoId;
    } catch (err) {
      console.error('YouTube 비디오 ID 가져오기 실패:', err);
      return '';
    }
  }, []);

  // 검색 결과 초기화
  const clearSearch = useCallback(() => {
    setPlaylists([]);
    setTracks([]);
    setCurrentOffset(0);
    setError(null);
  }, []);

  return {
    playlists,
    tracks,
    loading,
    error,
    searchPlaylistsByKeyword,
    loadPlaylistTracks,
    getVideoId,
    clearSearch,
  };
}
