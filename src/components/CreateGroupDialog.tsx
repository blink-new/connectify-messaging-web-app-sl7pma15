import { useState, useEffect, useCallback } from 'react'
import { Search, Users, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { blink } from '../blink/client'
import { useToast } from '../hooks/use-toast'

interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  status: string
  lastSeen?: number
}

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateGroup: (name: string, description: string, memberIds: string[]) => void
  currentUserId: string
}

export function CreateGroupDialog({ 
  open, 
  onOpenChange, 
  onCreateGroup, 
  currentUserId 
}: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const usersData = await blink.db.users.list({
        orderBy: { displayName: 'asc' }
      })
      
      // Filter out current user
      const filteredUsers = usersData.filter(user => user.id !== currentUserId)
      setUsers(filteredUsers)
    } catch (error) {
      console.error('Error loading users:', error)
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [currentUserId, toast])

  useEffect(() => {
    if (open) {
      loadUsers()
    }
  }, [open, loadUsers])

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true
    return (
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const handleToggleUser = (user: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id)
      if (isSelected) {
        return prev.filter(u => u.id !== user.id)
      } else {
        return [...prev, user]
      }
    })
  }

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive"
      })
      return
    }

    if (selectedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one member",
        variant: "destructive"
      })
      return
    }

    try {
      setCreating(true)
      const memberIds = selectedUsers.map(user => user.id)
      await onCreateGroup(groupName.trim(), groupDescription.trim(), memberIds)
      
      // Reset form
      setGroupName('')
      setGroupDescription('')
      setSelectedUsers([])
      setSearchQuery('')
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating group:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setGroupName('')
    setGroupDescription('')
    setSelectedUsers([])
    setSearchQuery('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Group Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="groupName">Group Name *</Label>
              <Input
                id="groupName"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="groupDescription">Description (Optional)</Label>
              <Textarea
                id="groupDescription"
                placeholder="Enter group description..."
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                className="mt-1 resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Selected Members */}
          {selectedUsers.length > 0 && (
            <div>
              <Label>Selected Members ({selectedUsers.length})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="flex items-center space-x-1 pr-1"
                  >
                    <span className="text-xs">{user.displayName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleRemoveUser(user.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* User Search */}
          <div>
            <Label>Add Members</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Users List */}
          <div className="max-h-48 overflow-y-auto custom-scrollbar border rounded-md">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{searchQuery ? 'No users found' : 'No other users available'}</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUsers.some(u => u.id === user.id)
                  
                  return (
                    <Button
                      key={user.id}
                      variant={isSelected ? "secondary" : "ghost"}
                      className="w-full justify-start p-3 h-auto"
                      onClick={() => handleToggleUser(user)}
                    >
                      <div className="flex items-center space-x-3 w-full">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            {user.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        {isSelected && (
                          <Badge variant="default" className="text-xs">
                            Selected
                          </Badge>
                        )}
                      </div>
                    </Button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length === 0 || creating}
            >
              {creating ? 'Creating...' : 'Create Group'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}