import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useSearch } from '../../contexts/SearchContext.tsx';
import { useNavigate, Link } from 'react-router-dom';
import { Users, Plus, Loader2, ArrowRight, Megaphone, ChevronRight } from 'lucide-react';
import { useLayout } from '../../contexts/LayoutContext.tsx';
import { motion } from 'motion/react';
import { useConversations } from '../chat/hooks/useConversations.ts';
import { ChatUserList } from '../chat/components/ChatUserList.tsx';
import { CommonSearchBar } from '../../components/common/CommonSearchBar';
import { useAuth } from '../../providers/AuthProvider.tsx';
import { supabase } from '../../lib/telegramClient';
import { LocalDataCache } from '../../services/LocalDataCache';
import Avatar from '../../components/common/Avatar';

export default function GroupsTab() {
  const navigate = useNavigate();
  const { user: authUser, userData } = useAuth();
  const { searchTerm, setSearchTerm } = useSearch();
  const { isChatSelectMode } = useLayout();
  const [subTab, setSubTab] = useState<'groups' | 'stories'>('groups');
  
  // Load conversation lists
  const { 
    conversations, 
    loading, 
    loadingMore, 
    hasMore, 
    loadMore 
  } = useConversations('Chats');

  // Filter conversations for Group Chats
  const filteredGroups = conversations.filter(c => {
    if (c.type !== 'group' || c.id === 'tg_news_channel') return false;

    if (!searchTerm) return true;
    return (c.user || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
           (c.username || "").toLowerCase().includes(searchTerm.toLowerCase());
  });

  const [stories, setStories] = useState<any[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);

  const fetchStories = useCallback(async () => {
    if (!authUser?.id) return;
    setStoriesLoading(true);
    try {
      const cachedStories = LocalDataCache.getHomeStories(authUser.id) || [];
      setStories(cachedStories);

      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          users (
            id,
            username,
            full_name,
            photo_url
          )
        `);

      if (!error && data) {
        setStories(data);
        LocalDataCache.saveHomeStories(authUser.id, data);
      }
    } catch (err) {
      console.error('Error fetching stories:', err);
    } finally {
      setStoriesLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (subTab === 'stories') {
      fetchStories();
    }
  }, [subTab, fetchStories]);

  const storiesGroupedByUser = useMemo(() => {
    const groups: { [key: string]: { userId: string; username: string; fullName: string; photoURL: string; stories: any[] } } = {};
    
    stories.forEach((story: any) => {
      const uid = story.user_id;
      const userObj = story.users;
      const username = userObj?.username || 'User';
      const fullName = userObj?.full_name || username;
      const photoURL = userObj?.photo_url || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
      
      if (!groups[uid]) {
        groups[uid] = {
          userId: uid,
          username,
          fullName,
          photoURL,
          stories: []
        };
      }
      groups[uid].stories.push(story);
    });

    return Object.values(groups);
  }, [stories]);

  const myStoriesGroup = storiesGroupedByUser.find(g => g.userId === authUser?.id);
  const otherStoriesGroups = useMemo(() => {
    const list = storiesGroupedByUser.filter(g => g.userId !== authUser?.id);
    if (!searchTerm) return list;
    const query = searchTerm.toLowerCase();
    return list.filter(g => 
      (g.fullName || '').toLowerCase().includes(query) || 
      (g.username || '').toLowerCase().includes(query)
    );
  }, [storiesGroupedByUser, authUser?.id, searchTerm]);

  const formatStoryTime = (createdAtString: string) => {
    if (!createdAtString) return '';
    const date = new Date(createdAtString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const isToday = date.toDateString() === now.toDateString();
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    
    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], options)}`;
    }
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) {
      return `Yesterday, ${date.toLocaleTimeString([], options)}`;
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + date.toLocaleTimeString([], options);
  };

  const myStoryName = userData?.fullName || authUser?.email?.split('@')[0] || "My Story";

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isScrollable = target.scrollHeight > target.clientHeight;
    const closeToBottom = target.scrollHeight - target.scrollTop - target.clientHeight <= 100;
    if (isScrollable && target.scrollTop > 5 && closeToBottom) {
      if (hasMore && !loadingMore) {
        loadMore();
      }
    }
  }, [hasMore, loadingMore, loadMore]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-card)] overflow-hidden animate-fade-in touch-pan-y">
      <div onScroll={handleScroll} className="flex-1 overflow-y-auto no-scrollbar pb-32 bg-[var(--bg-card)]">
        
        {/* Scrollable Search Bar at the very top */}
        <CommonSearchBar 
          placeholder={subTab === 'groups' ? "Search active groups..." : "Search stories..."}
          value={searchTerm}
          onChange={setSearchTerm}
          onClear={() => setSearchTerm('')}
        />

        {/* Switch Button (Segmented Control) for Groups and Stories below Search Bar */}
        <div className="px-4 pt-1 pb-2 select-none shrink-0">
          <div className="flex bg-[var(--bg-main)]/80 backdrop-blur-md border border-[var(--border-color)]/10 p-1 gap-1 rounded-xl">
            <button 
              onClick={() => setSubTab('groups')}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center relative ${
                subTab === 'groups'
                  ? 'bg-[#0494f4] text-white shadow-sm shadow-[#0494f4]/15'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/40'
              }`}
            >
              <span>Groups</span>
            </button>
            <button 
              onClick={() => setSubTab('stories')}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center relative ${
                subTab === 'stories'
                  ? 'bg-[#0494f4] text-white shadow-sm shadow-[#0494f4]/15'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/40'
              }`}
            >
              <span>Stories</span>
            </button>
          </div>
        </div>

        {/* Groups or Stories List */}
        {subTab === 'stories' ? (
          /* WHATSAPP-STYLE STORIES LIST VIEW */
          <div className="flex flex-col mt-1 bg-[var(--bg-card)] animate-fade-in">
            {/* MY STATUS TILE */}
            <div 
              onClick={() => {
                if (myStoriesGroup) {
                  navigate(`/stories/view/${authUser?.id}`);
                } else {
                  navigate('/stories/create');
                }
              }}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--border-color)]/5 active:bg-[var(--border-color)]/10 transition-all duration-205 group cursor-pointer select-none border-b border-[var(--border-color)]/5 last:border-b-0 border-l-[4px] border-l-transparent"
            >
              {/* Left: Avatar with dynamic Ring or Plus Overlay */}
              <div className="relative shrink-0">
                {myStoriesGroup ? (
                  <Avatar 
                    url={userData?.photoURL} 
                    type="direct" 
                    name={myStoryName} 
                  />
                ) : (
                  <div className="relative">
                    <Avatar 
                      url={userData?.photoURL} 
                      type="direct" 
                      name={myStoryName} 
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] bg-[#0494f4] text-white rounded-full flex items-center justify-center border-2 border-[var(--bg-card)] shadow-md">
                      <Plus size={11} strokeWidth={3.5} />
                    </div>
                  </div>
                )}
              </div>

              {/* Middle: Details */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="text-[14.5px] truncate font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                  {myStoryName}
                </h3>
                <p className="text-[13px] text-[var(--text-secondary)] opacity-75 mt-0.5 font-medium">
                  {myStoriesGroup 
                    ? formatStoryTime(myStoriesGroup.stories[0].created_at)
                    : 'Tap to publish a status update'
                  }
                </p>
              </div>

              {/* Right: navigation chevron */}
              <ChevronRight size={16} className="text-[var(--text-secondary)] opacity-15 group-hover:opacity-60 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
            </div>

            {/* FRIENDS' STATUSES (RECENT UPDATES) */}
            {storiesLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="animate-spin text-[#0494f4]" size={20} />
                <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-secondary)]">Loading stories...</span>
              </div>
            ) : otherStoriesGroups.length === 0 ? (
              <div className="px-5 py-8 text-center bg-[var(--bg-card)] border-b border-[var(--border-color)]/5 last:border-b-0">
                <p className="text-xs text-[var(--text-secondary)] opacity-75 italic">No shared status updates from other friends yet.</p>
              </div>
            ) : (
              otherStoriesGroups.map(group => (
                <div 
                  key={group.userId}
                  onClick={() => navigate(`/stories/view/${group.userId}`)}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--border-color)]/5 active:bg-[var(--border-color)]/10 transition-all duration-205 group cursor-pointer select-none border-b border-[var(--border-color)]/5 last:border-b-0 border-l-[4px] border-l-transparent"
                >
                  {/* Left: Avatar with brand themed ring */}
                  <div className="relative shrink-0">
                    <Avatar 
                      url={group.photoURL} 
                      type="direct" 
                      name={group.username} 
                    />
                  </div>

                  {/* Middle: Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="text-[14.5px] truncate font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                      {group.fullName || group.username}
                    </h3>
                    <p className="text-[13px] text-[var(--text-secondary)] opacity-75 mt-0.5 font-medium">
                      {formatStoryTime(group.stories[0].created_at)}
                    </p>
                  </div>

                  {/* Right: navigation chevron */}
                  <ChevronRight size={16} className="text-[var(--text-secondary)] opacity-15 group-hover:opacity-60 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
                </div>
              ))
            )}
          </div>
        ) : (
          /* GROUPS LIST VIEW */
          <div className="flex flex-col mt-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-[#0494f4]" size={24} />
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">Loading Groups...</p>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4 animate-fade-in">
                <div className="p-4 bg-[var(--bg-main)] rounded-2xl text-[var(--text-secondary)] shadow-sm border border-[var(--border-color)]/10">
                  <Users size={36} className="opacity-80" />
                </div>
                <div className="max-w-xs">
                  <h3 className="text-xs font-black text-[var(--text-primary)] mb-1 uppercase tracking-wider">
                    No Groups Joined
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    Start or coordinate a new group chat with your contacts to see active rooms here.
                  </p>
                  <button 
                    onClick={() => navigate('/new-group?type=group')}
                    className="mt-4 px-4 py-2 bg-[#0494f4]/10 hover:bg-[#0494f4]/20 text-[#0494f4] font-extrabold text-[10px] uppercase tracking-wider rounded-xl inline-flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <span>Create Group</span>
                    <ArrowRight size={10} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <ChatUserList 
                  conversations={filteredGroups}
                  otherUsers={[]}
                  showGrixAI={false}
                  archivedCount={0}
                  showSecretHeader={false}
                  emptyMessage="No active groups"
                  emptySubMessage="Coordinate a group chat."
                  loading={loading}
                  usersWithStories={[]}
                  showHiddenChatsEntry={false}
                />
                {loadingMore && (
                  <div className="flex items-center justify-center py-4 gap-2 bg-[var(--bg-card)]">
                    <Loader2 size={16} className="text-[#0494f4] animate-spin" />
                    <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Loading more...</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
