import React, { useState, useEffect } from "react";
import { X, Phone, MessageSquare } from "lucide-react";
import { WEB_GATEWAY_BASE_URL } from "../lib/runtime-base-url";

interface UserProfile {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
}

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
  onMessage: (userId: string) => void;
}

export default function UserProfileModal({ userId, onClose, onMessage }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${WEB_GATEWAY_BASE_URL}/api/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }
        
        const data = await response.json();
        setProfile(data.data);
      } catch (err) {
        setError("Không thể tải thông tin người dùng.");
      } finally {
        setLoading(false);
      }
    };
    
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1A1A1A] text-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Actions */}
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          <button 
            onClick={onClose}
            className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cover Photo */}
        <div className="relative h-48 bg-gray-800">
          {profile?.coverUrl ? (
            <img 
              src={profile.coverUrl} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600"></div>
          )}
          
          {/* Avatar */}
          <div className="absolute -bottom-10 left-6">
            <img 
              src={profile?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.fullName || 'User')}&background=random`} 
              alt={profile?.fullName} 
              className="w-24 h-24 rounded-full border-4 border-[#1A1A1A] object-cover"
            />
          </div>
        </div>

        {/* Profile Info */}
        <div className="pt-12 pb-6 px-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {profile?.fullName || 'Đang tải...'}
          </h2>
          
          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors">
              <Phone size={18} />
              Gọi điện
            </button>
            <button 
              onClick={() => onMessage(userId)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <MessageSquare size={18} />
              Nhắn tin
            </button>
          </div>

          {/* Details Section */}
          <div className="mt-8 space-y-4">
            <h3 className="font-semibold text-lg border-b border-gray-800 pb-2">Thông tin cá nhân</h3>
            
            {loading ? (
              <div className="text-gray-400">Đang tải...</div>
            ) : error ? (
              <div className="text-red-400">{error}</div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex">
                  <span className="text-gray-400 w-24 shrink-0">Bio</span>
                  <span className="text-gray-200">{profile?.bio || 'Chưa cập nhật'}</span>
                </div>
                
                {profile?.gender && (
                  <div className="flex">
                    <span className="text-gray-400 w-24 shrink-0">Giới tính</span>
                    <span className="text-gray-200">
                      {profile.gender === 'MALE' ? 'Nam' : profile.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
                    </span>
                  </div>
                )}
                
                {profile?.dateOfBirth && (
                  <div className="flex">
                    <span className="text-gray-400 w-24 shrink-0">Ngày sinh</span>
                    <span className="text-gray-200">
                      {new Date(profile.dateOfBirth).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                )}
                
                <div className="flex">
                  <span className="text-gray-400 w-24 shrink-0">Điện thoại</span>
                  <span className="text-gray-200">{profile?.phone ? '********' + profile.phone.slice(-3) : 'Chưa cập nhật'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
