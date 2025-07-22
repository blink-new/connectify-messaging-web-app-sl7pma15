import { useState, useEffect, useCallback } from 'react'
import { blink } from './blink/client'
import { ChatSidebar } from './components/ChatSidebar'
import { ChatView } from './components/ChatView'
import { CreateGroupDialog } from './components/CreateGroupDialog'
import { GuestLogin } from './components/GuestLogin'
import { Toaster } from './components/ui/toaster'
import { useToast } from './hooks/use-toast'

interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  status: string
  lastSeen?: number
  isGuest?: boolean
  guestName?: string
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

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showGuestLogin, setShowGuestLogin] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const { toast } = useToast()

  // Check for invite code in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const invite = urlParams.get('invite')
    if (invite) {
      setInviteCode(invite)
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const loadConversations = useCallback(async (userId: string) => {
    try {
      // Get conversations where user is a member
      const membershipData = await blink.db.conversationMembers.list({
        where: { userId },
        orderBy: { joinedAt: 'desc' }
      })

      if (membershipData.length === 0) {
        setConversations([])
        return
      }

      const conversationIds = membershipData.map(m => m.conversationId)
      
      // Get conversation details
      const conversationsData = await blink.db.conversations.list({
        where: {
          OR: conversationIds.map(id => ({ id }))
        },
        orderBy: { lastMessageAt: 'desc' }
      })

      // Get last message for each conversation
      const conversationsWithDetails = await Promise.all(
        conversationsData.map(async (conv) => {
          // Get last message
          const lastMessages = await blink.db.messages.list({
            where: { conversationId: conv.id },
            orderBy: { createdAt: 'desc' },
            limit: 1
          })

          let lastMessage = undefined
          if (lastMessages.length > 0) {
            const msg = lastMessages[0]
            const sender = await blink.db.users.list({
              where: { id: msg.userId },
              limit: 1
            })
            lastMessage = {
              content: msg.content || (msg.messageType === 'file' ? `📎 ${msg.fileName}` : 'File'),
              senderName: sender[0]?.displayName || 'Unknown',
              createdAt: msg.createdAt
            }
          }

          // Get members for group chats
          let members = undefined
          if (conv.type === 'group') {
            const memberIds = await blink.db.conversationMembers.list({
              where: { conversationId: conv.id }
            })
            const memberDetails = await Promise.all(
              memberIds.map(async (m) => {
                const userData = await blink.db.users.list({
                  where: { id: m.userId },
                  limit: 1
                })
                return userData[0]
              })
            )
            members = memberDetails.filter(Boolean)
          }

          return {
            ...conv,
            lastMessage,
            members
          }
        })
      )

      setConversations(conversationsWithDetails)
    } catch (error) {
      console.error('Error loading conversations:', error)
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      })
    }
  }, [toast])

  const handleInviteJoin = useCallback(async (currentUser: User, code: string) => {
    try {
      // Find the invite
      const invites = await blink.db.invites.list({
        where: { inviteCode: code, isActive: true },
        limit: 1
      })

      if (invites.length === 0) {
        toast({
          title: "Invalid Invite",
          description: "This invite link is invalid or has expired",
          variant: "destructive"
        })
        return
      }

      const invite = invites[0]

      // Check if invite is still valid
      if (invite.expiresAt && invite.expiresAt < Date.now()) {
        toast({
          title: "Expired Invite",
          description: "This invite link has expired",
          variant: "destructive"
        })
        return
      }

      if (invite.maxUses && invite.currentUses >= invite.maxUses) {
        toast({
          title: "Invite Limit Reached",
          description: "This invite link has reached its usage limit",
          variant: "destructive"
        })
        return
      }

      // Check if user is already a member
      const existingMembership = await blink.db.conversationMembers.list({
        where: { conversationId: invite.conversationId, userId: currentUser.id },
        limit: 1
      })

      if (existingMembership.length === 0) {
        // Add user to conversation
        await blink.db.conversationMembers.create({
          id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conversationId: invite.conversationId,
          userId: currentUser.id,
          role: currentUser.isGuest ? 'guest' : 'member'
        })

        // Update invite usage
        await blink.db.invites.update(invite.id, {
          currentUses: invite.currentUses + 1
        })
      }

      // Load conversations and select the invited one
      await loadConversations(currentUser.id)
      
      // Find and select the conversation
      const conv = await blink.db.conversations.list({
        where: { id: invite.conversationId },
        limit: 1
      })
      
      if (conv.length > 0) {
        setSelectedConversation(conv[0])
      }

      toast({
        title: "Joined Chat!",
        description: "You've successfully joined the conversation"
      })
    } catch (error) {
      console.error('Error joining via invite:', error)
      toast({
        title: "Error",
        description: "Failed to join conversation",
        variant: "destructive"
      })
    }
  }, [loadConversations, toast])

  const handleGuestLogin = useCallback(async (guestName: string) => {
    try {
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Create guest user in database
      await blink.db.users.create({
        id: guestId,
        email: `${guestId}@guest.connectify`,
        displayName: guestName,
        status: 'online',
        lastSeen: Date.now(),
        isGuest: true,
        guestName: guestName
      })

      const guestUser: User = {
        id: guestId,
        email: `${guestId}@guest.connectify`,
        displayName: guestName,
        status: 'online',
        isGuest: true,
        guestName: guestName
      }

      setUser(guestUser)
      setShowGuestLogin(false)

      // If there's an invite code, join the conversation
      if (inviteCode) {
        await handleInviteJoin(guestUser, inviteCode)
        setInviteCode(null)
      }

      toast({
        title: "Welcome!",
        description: `Signed in as guest: ${guestName}`
      })
    } catch (error) {
      console.error('Error creating guest user:', error)
      toast({
        title: "Error",
        description: "Failed to sign in as guest",
        variant: "destructive"
      })
    }
  }, [inviteCode, handleInviteJoin, toast])

  // Initialize user and load data
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged(async (state) => {
      if (state.user) {
        try {
          // Create or update user profile
          await blink.db.users.create({
            id: state.user.id,
            email: state.user.email,
            displayName: state.user.email.split('@')[0],
            status: 'online',
            lastSeen: Date.now(),
            isGuest: false
          })
          
          const authenticatedUser: User = {
            id: state.user.id,
            email: state.user.email,
            displayName: state.user.email.split('@')[0],
            status: 'online',
            isGuest: false
          }
          
          setUser(authenticatedUser)
          
          // Load conversations
          await loadConversations(state.user.id)

          // If there's an invite code, join the conversation
          if (inviteCode) {
            await handleInviteJoin(authenticatedUser, inviteCode)
            setInviteCode(null)
          }
        } catch (error) {
          console.error('Error setting up user:', error)
          toast({
            title: "Error",
            description: "Failed to initialize user profile",
            variant: "destructive"
          })
        }
      } else {
        // Show guest login if there's an invite code or user chooses guest option
        if (inviteCode || showGuestLogin) {
          setShowGuestLogin(true)
        }
        setUser(null)
      }
      setLoading(state.isLoading)
    })

    return unsubscribe
  }, [loadConversations, toast, inviteCode, showGuestLogin, handleInviteJoin])

  const handleCreatePrivateChat = async (targetUserId: string) => {
    if (!user) return

    try {
      // Check if private conversation already exists
      const existingMemberships = await blink.db.conversationMembers.list({
        where: { userId: user.id }
      })

      for (const membership of existingMemberships) {
        const conv = await blink.db.conversations.list({
          where: { id: membership.conversationId, type: 'private' },
          limit: 1
        })
        
        if (conv.length > 0) {
          const otherMembers = await blink.db.conversationMembers.list({
            where: { conversationId: conv[0].id }
          })
          
          if (otherMembers.length === 2 && otherMembers.some(m => m.userId === targetUserId)) {
            setSelectedConversation(conv[0])
            return
          }
        }
      }

      // Create new private conversation
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await blink.db.conversations.create({
        id: conversationId,
        type: 'private',
        createdBy: user.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: Date.now()
      })

      // Add both users as members
      await blink.db.conversationMembers.createMany([
        {
          id: `member_${Date.now()}_1`,
          conversationId,
          userId: user.id,
          role: 'member'
        },
        {
          id: `member_${Date.now()}_2`,
          conversationId,
          userId: targetUserId,
          role: 'member'
        }
      ])

      await loadConversations(user.id)
      
      toast({
        title: "Success",
        description: "Private chat created successfully"
      })
    } catch (error) {
      console.error('Error creating private chat:', error)
      toast({
        title: "Error",
        description: "Failed to create private chat",
        variant: "destructive"
      })
    }
  }

  const handleCreateGroup = async (name: string, description: string, memberIds: string[]) => {
    if (!user) return

    try {
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await blink.db.conversations.create({
        id: conversationId,
        type: 'group',
        name,
        description,
        createdBy: user.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: Date.now()
      })

      // Add creator as admin
      const members = [
        {
          id: `member_${Date.now()}_0`,
          conversationId,
          userId: user.id,
          role: user.isGuest ? 'guest' : 'admin'
        }
      ]

      // Add other members
      memberIds.forEach((memberId, index) => {
        members.push({
          id: `member_${Date.now()}_${index + 1}`,
          conversationId,
          userId: memberId,
          role: 'member'
        })
      })

      await blink.db.conversationMembers.createMany(members)
      await loadConversations(user.id)
      
      toast({
        title: "Success",
        description: "Group chat created successfully"
      })
    } catch (error) {
      console.error('Error creating group:', error)
      toast({
        title: "Error",
        description: "Failed to create group chat",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Connectify...</p>
        </div>
      </div>
    )
  }

  if (showGuestLogin) {
    return (
      <GuestLogin
        onGuestLogin={handleGuestLogin}
        onSignIn={() => {
          setShowGuestLogin(false)
          blink.auth.login()
        }}
      />
    )
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <h1 className="text-3xl font-bold text-primary mb-4">Welcome to Connectify</h1>
          <p className="text-muted-foreground mb-6">
            Connect with friends and colleagues through secure messaging and file sharing.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => blink.auth.login()}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Sign In with Account
            </button>
            <button
              onClick={() => setShowGuestLogin(true)}
              className="w-full bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-medium hover:bg-secondary/90 transition-colors"
            >
              Continue as Guest
            </button>
          </div>
          {inviteCode && (
            <p className="text-sm text-muted-foreground mt-4">
              You've been invited to join a conversation
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-background">
      <ChatSidebar
        user={user}
        conversations={conversations}
        selectedConversation={selectedConversation}
        onSelectConversation={setSelectedConversation}
        onCreatePrivateChat={handleCreatePrivateChat}
        onCreateGroup={() => setShowCreateGroup(true)}
        onRefresh={() => loadConversations(user.id)}
      />
      
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <ChatView
            user={user}
            conversation={selectedConversation}
            onRefresh={() => loadConversations(user.id)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p className="text-muted-foreground">Choose a chat from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>

      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        onCreateGroup={handleCreateGroup}
        currentUserId={user.id}
      />

      <Toaster />
    </div>
  )
}

export default App