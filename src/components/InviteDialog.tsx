import React, { useState, useEffect, useCallback } from 'react'
import { X, Copy, Link, Users, Clock, Hash, Check } from 'lucide-react'
import { blink } from '../blink/client'

interface InviteDialogProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string
  conversationName: string
}

export function InviteDialog({ isOpen, onClose, conversationId, conversationName }: InviteDialogProps) {
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expiresIn, setExpiresIn] = useState('24') // hours
  const [maxUses, setMaxUses] = useState('10')

  const generateInviteLink = useCallback(async () => {
    setLoading(true)
    try {
      const user = await blink.auth.me()
      const inviteCode = Math.random().toString(36).substring(2, 15)
      const expiresAt = Date.now() + (parseInt(expiresIn) * 60 * 60 * 1000)

      await blink.db.invites.create({
        id: `invite_${Date.now()}`,
        conversation_id: conversationId,
        created_by: user.id,
        invite_code: inviteCode,
        expires_at: expiresAt,
        max_uses: parseInt(maxUses),
        current_uses: 0,
        is_active: true
      })

      const baseUrl = window.location.origin
      setInviteLink(`${baseUrl}?invite=${inviteCode}`)
    } catch (error) {
      console.error('Failed to generate invite link:', error)
    } finally {
      setLoading(false)
    }
  }, [conversationId, expiresIn, maxUses])

  useEffect(() => {
    if (isOpen) {
      generateInviteLink()
    }
  }, [isOpen, generateInviteLink])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Link className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Invite to Chat</h2>
              <p className="text-sm text-gray-500">{conversationName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invite Link Settings
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Expires in (hours)
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <Hash className="w-3 h-3 inline mr-1" />
                  Max uses
                </label>
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="1">1 use</option>
                  <option value="5">5 uses</option>
                  <option value="10">10 uses</option>
                  <option value="50">50 uses</option>
                  <option value="999">Unlimited</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share this link
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="w-full bg-transparent text-sm text-gray-600 focus:outline-none"
                  placeholder={loading ? "Generating link..." : ""}
                />
              </div>
              <button
                onClick={copyToClipboard}
                disabled={loading || !inviteLink}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="text-sm">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="text-sm">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Users className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Guest Access</h4>
                <p className="text-xs text-blue-700 mt-1">
                  Anyone with this link can join as a guest without creating an account. 
                  They'll be able to participate in the conversation with limited features.
                </p>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={generateInviteLink}
              disabled={loading}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              Generate New Link
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}