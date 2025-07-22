import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Paperclip, Download, Users, MoreVertical, UserPlus } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Badge } from './ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Progress } from './ui/progress'
import { blink } from '../blink/client'
import { useToast } from '../hooks/use-toast'
import { InviteDialog } from './InviteDialog'

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
}

interface Message {
  id: string
  conversationId: string
  userId: string
  content?: string
  messageType: 'text' | 'file' | 'image'
  fileUrl?: string
  fileName?: string
  fileSize?: number
  fileType?: string
  createdAt: number
  user?: User
}

interface ChatViewProps {
  user: User
  conversation: Conversation
  onRefresh: () => void
}

export function ChatView({ user, conversation, onRefresh }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)
      const messagesData = await blink.db.messages.list({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' }
      })

      // Get user details for each message
      const messagesWithUsers = await Promise.all(
        messagesData.map(async (msg) => {
          const userData = await blink.db.users.list({
            where: { id: msg.userId },
            limit: 1
          })
          return {
            ...msg,
            user: userData[0]
          }
        })
      )

      setMessages(messagesWithUsers)
    } catch (error) {
      console.error('Error loading messages:', error)
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [conversation.id, toast])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return

    try {
      setSending(true)
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await blink.db.messages.create({
        id: messageId,
        conversationId: conversation.id,
        userId: user.id,
        content: newMessage.trim(),
        messageType: 'text',
        createdAt: Date.now()
      })

      // Update conversation's last message time
      await blink.db.conversations.update(conversation.id, {
        lastMessageAt: Date.now(),
        updatedAt: Date.now()
      })

      setNewMessage('')
      await loadMessages()
      onRefresh()
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      })
    } finally {
      setSending(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return

    try {
      setUploadProgress(0)
      
      // Upload file to storage
      const { publicUrl } = await blink.storage.upload(
        file,
        `chat-files/${conversation.id}/${Date.now()}_${file.name}`,
        {
          upsert: true,
          onProgress: (percent) => setUploadProgress(percent)
        }
      )

      // Create message with file
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const messageType = file.type.startsWith('image/') ? 'image' : 'file'
      
      await blink.db.messages.create({
        id: messageId,
        conversationId: conversation.id,
        userId: user.id,
        messageType,
        fileUrl: publicUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        createdAt: Date.now()
      })

      // Update conversation's last message time
      await blink.db.conversations.update(conversation.id, {
        lastMessageAt: Date.now(),
        updatedAt: Date.now()
      })

      await loadMessages()
      onRefresh()
      
      toast({
        title: "Success",
        description: "File uploaded successfully"
      })
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive"
      })
    } finally {
      setUploadProgress(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getConversationTitle = () => {
    if (conversation.type === 'group') {
      return conversation.name || 'Unnamed Group'
    } else {
      const otherMember = conversation.members?.find(m => m.id !== user.id)
      return otherMember?.displayName || 'Unknown User'
    }
  }

  const getConversationSubtitle = () => {
    if (conversation.type === 'group') {
      const memberCount = conversation.members?.length || 0
      return `${memberCount} members`
    } else {
      const otherMember = conversation.members?.find(m => m.id !== user.id)
      return otherMember?.email || ''
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-muted text-muted-foreground">
                {conversation.type === 'group' 
                  ? (conversation.name?.charAt(0).toUpperCase() || 'G')
                  : (conversation.members?.find(m => m.id !== user.id)?.displayName.charAt(0).toUpperCase() || 'U')
                }
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold">{getConversationTitle()}</h2>
              <p className="text-sm text-muted-foreground">{getConversationSubtitle()}</p>
            </div>
            {conversation.type === 'group' && (
              <Badge variant="secondary" className="ml-2">
                <Users className="h-3 w-3 mr-1" />
                Group
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInviteDialog(true)}
              className="h-8 px-3"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Invite
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={loadMessages}>
                  Refresh Messages
                </DropdownMenuItem>
                {conversation.type === 'group' && (
                  <DropdownMenuItem>
                    View Members
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        className={`flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 ${
          dragOver ? 'bg-primary/5 border-2 border-dashed border-primary' : ''
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 z-10">
            <div className="text-center">
              <Paperclip className="h-12 w-12 text-primary mx-auto mb-2" />
              <p className="text-primary font-medium">Drop files here to upload</p>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="h-8 w-8" />
            </div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.userId === user.id
            
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} message-enter`}
              >
                <div className={`flex space-x-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {!isOwnMessage && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {message.user?.displayName.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={`rounded-lg p-3 ${
                    isOwnMessage 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    {!isOwnMessage && conversation.type === 'group' && (
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {message.user?.displayName}
                      </p>
                    )}
                    
                    {message.messageType === 'text' && (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                    
                    {message.messageType === 'image' && (
                      <div className="space-y-2">
                        <img
                          src={message.fileUrl}
                          alt={message.fileName}
                          className="max-w-full h-auto rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(message.fileUrl, '_blank')}
                        />
                        <div className="flex items-center justify-between text-xs opacity-70">
                          <span>{message.fileName}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => window.open(message.fileUrl, '_blank')}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {message.messageType === 'file' && (
                      <div className="flex items-center space-x-3 p-2 bg-background/10 rounded-md">
                        <div className="flex-shrink-0">
                          <Paperclip className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{message.fileName}</p>
                          <p className="text-xs opacity-70">
                            {message.fileSize && formatFileSize(message.fileSize)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => window.open(message.fileUrl, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    <p className="text-xs opacity-70 mt-1">
                      {formatMessageTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upload Progress */}
      {uploadProgress !== null && (
        <div className="px-4 py-2 border-t border-border">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Uploading...</span>
            <Progress value={uploadProgress} className="flex-1" />
            <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-end space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
            className="flex-shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <div className="flex-1">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              disabled={sending || uploadProgress !== null}
              className="resize-none"
            />
          </div>
          
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending || uploadProgress !== null}
            size="sm"
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleFileUpload(file)
          }
        }}
        accept="*/*"
      />

      <InviteDialog
        isOpen={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        conversationId={conversation.id}
        conversationName={getConversationTitle()}
      />
    </div>
  )
}