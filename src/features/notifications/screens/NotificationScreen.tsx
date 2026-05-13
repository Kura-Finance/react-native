import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useNotificationStore } from '../../../shared/store/notification';
import {
  categoryAccentColor,
  categoryFallbackIcon,
  isUnread,
  type Notification,
} from '../../../lib/api/notification';
import { useAppStore } from '../../../shared/store/useAppStore';
import Logger from '../../../shared/utils/Logger';

function getRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationScreen() {
  const insets = useSafeAreaInsets();
  const authToken = useAppStore((state) => state.authToken);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();

  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const isLoading = useNotificationStore((state) => state.isLoading);
  const loadNotifications = useNotificationStore((state) => state.loadNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markBatchAsRead = useNotificationStore((state) => state.markBatchAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  useEffect(() => {
    if (authToken) {
      void loadNotifications();
    }
  }, [authToken, loadNotifications]);

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      try {
        await markAsRead(id);
      } catch (error) {
        Logger.warn('NotificationScreen', 'mark-as-read failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [markAsRead],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await removeNotification(id);
      } catch (error) {
        Logger.warn('NotificationScreen', 'delete failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [removeNotification],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    const unread = notifications.filter(isUnread).map((n) => n.id);
    if (unread.length === 0) return;
    try {
      await markBatchAsRead(unread);
    } catch (error) {
      Logger.warn('NotificationScreen', 'batch read failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  }, [markBatchAsRead, notifications]);

  const renderNotification = ({ item }: { item: Notification }) => {
    const unread = isUnread(item);
    const color = categoryAccentColor(item.category);
    return (
      <TouchableOpacity
        onPress={() => unread && handleMarkAsRead(item.id)}
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: unread ? 'rgba(139, 92, 246, 0.05)' : 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.05)',
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: `${color}20`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name={categoryFallbackIcon(item.category) as any}
            size={20}
            color={color}
          />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1 }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {unread && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#8B5CF6',
                  marginLeft: 8,
                }}
              />
            )}
          </View>
          <Text style={{ color: '#999999', fontSize: 12, marginTop: 4 }} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={{ color: '#666666', fontSize: 11, marginTop: 4 }}>
            {getRelativeTime(item.createdAt)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          style={{ paddingLeft: 12, justifyContent: 'center' }}
        >
          <Ionicons name="close-circle" size={20} color="#666666" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0B0B0F',
        paddingTop: Math.max(insets.top, 10),
      }}
    >
      <View
        style={{
          paddingHorizontal: 24,
          paddingVertical: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' }}>Notifications</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('NotificationSettings')}>
          <Ionicons name="settings-outline" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      {unreadCount > 0 && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={{ color: '#8B5CF6', fontSize: 13, fontWeight: '600' }}>
              Mark all as read ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && notifications.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#8B5CF6" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => void loadNotifications()}
              tintColor="#8B5CF6"
            />
          }
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
              <Ionicons name="notifications-outline" size={48} color="#666666" />
              <Text style={{ color: '#666666', fontSize: 14, marginTop: 12 }}>No notifications</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
