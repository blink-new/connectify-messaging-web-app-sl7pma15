import { useState } from 'react'
import { Search, Plus, Users, MessageCircle, MoreVertical, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Badge } from './ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { UserSearchDialog } from './UserSearchDialog'
import { blink } from '../blink/client'

interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  status: string
  lastSeen?: number
}

interface Conversation {
  id: string
  type: 'private' | 'group'
  name?: string
  description?: string
  avatarUrl?: string
  createdBy: string
  createdAt: number
  updatedAt: number
  lastMessageAt: number
  members?: User[]
  lastMessage?: {
    content: string
    senderName: string
    createdAt: number
  }
}

interface ChatSidebarProps {
  user: User
  conversations: Conversation[]
  selectedConversation: Conversation | null
  onSelectConversation: (conversation: Conversation) => void
  onCreatePrivateChat: (userId: string) => void
  onCreateGroup: () => void
  onRefresh: () => void
}

export function ChatSidebar({
  user,
  conversations,
  selectedConversation,
  onSelectConversation,
  onCreatePrivateChat,
  onCreateGroup,
  onRefresh
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserSearch, setShowUserSearch] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true
    
    if (conv.type === 'group') {
      return conv.name?.toLowerCase().includes(searchQuery.toLowerCase())
    } else {
      // For private chats, search by other user's name
      const otherMember = conv.members?.find(m => m.id !== user.id)
      return otherMember?.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    }
  })

  const getConversationName = (conversation: Conversation) => {
    if (conversation.type === 'group') {
      return conversation.name || 'Unnamed Group'
    } else {
      const otherMember = conversation.members?.find(m => m.id !== user.id)
      return otherMember?.displayName || 'Unknown User'
    }
  }

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.type === 'group') {
      return conversation.name?.charAt(0).toUpperCase() || 'G'
    } else {
      const otherMember = conversation.members?.find(m => m.id !== user.id)
      return otherMember?.displayName.charAt(0).toUpperCase() || 'U'
    }
  }

  const formatLastMessageTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    
    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
    
    return new Date(timestamp).toLocaleDateString()
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setTimeout(() => setRefreshing(false), 500)
  }

  const handleLogout = () => {
    blink.auth.logout()
  }

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {user.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-sm">{user.displayName}</h2>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-b border-border">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUserSearch(true)}
            className="flex-1"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            New Chat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateGroup}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-2" />
            New Group
          </Button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/50 ${
                  selectedConversation?.id === conversation.id
                    ? 'bg-accent text-accent-foreground'
                    : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        {getConversationAvatar(conversation)}
                      </AvatarFallback>
                    </Avatar>
                    {conversation.type === 'group' && (
                      <Badge
                        variant="secondary"
                        className="absolute -bottom-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                      >
                        {conversation.members?.length || 0}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm truncate">
                        {getConversationName(conversation)}
                      </h3>
                      {conversation.lastMessage && (
                        <span className="text-xs text-muted-foreground">
                          {formatLastMessageTime(conversation.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    
                    {conversation.lastMessage ? (
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-muted-foreground truncate">
                          {conversation.type === 'group' && `${conversation.lastMessage.senderName}: `}
                          {conversation.lastMessage.content}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No messages yet</p>
                    )}
                    
                    {conversation.type === 'group' && conversation.description && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {conversation.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <UserSearchDialog
        open={showUserSearch}
        onOpenChange={setShowUserSearch}
        onSelectUser={onCreatePrivateChat}
        currentUserId={user.id}
      />
    </div>
  )
}