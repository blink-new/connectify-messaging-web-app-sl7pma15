import React, { useState } from 'react'
import { User, MessageCircle } from 'lucide-react'

interface GuestLoginProps {
  onGuestLogin: (name: string) => void
  onSignIn: () => void
}

export function GuestLogin({ onGuestLogin, onSignIn }: GuestLoginProps) {
  const [guestName, setGuestName] = useState('')

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (guestName.trim()) {
      onGuestLogin(guestName.trim())
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Connectify</h1>
          <p className="text-gray-600">Join the conversation</p>
        </div>

        <div className="space-y-4">
          <form onSubmit={handleGuestSubmit} className="space-y-4">
            <div>
              <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-2">
                Enter your name to continue as guest
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="guestName"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Continue as Guest
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <button
            onClick={onSignIn}
            className="w-full bg-white text-gray-700 py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium"
          >
            Sign In with Account
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          Guest access allows you to join conversations but some features may be limited
        </p>
      </div>
    </div>
  )
}