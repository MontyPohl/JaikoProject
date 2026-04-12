import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Briefcase } from 'lucide-react';
import { Avatar, Badge } from './index';

const ProfileCard = ({ profile, compatibility }) => {
  return (
    <Link to={`/profile/${profile.user_id}`} className="card group p-6 flex flex-col items-center text-center">
      <div className="relative mb-4">
        <Avatar src={profile.profile_photo_url} name={profile.name} size="xl" verified={profile.verified} />
        {compatibility && (
          <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg">
            {compatibility}% Match
          </div>
        )}
      </div>
      <h3 className="font-display font-extrabold text-lg text-slate-900 mb-1">{profile.name}, {profile.age}</h3>
      <p className="text-slate-400 text-xs mb-4 flex items-center gap-1">
        <Briefcase size={12} /> {profile.profession || 'Sin especificar'}
      </p>
      <div className="flex items-center gap-1 text-slate-500 text-xs mb-6">
        <MapPin size={12} className="text-orange-500" />
        <span>{profile.city}</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-auto">
        {profile.pets && <Badge variant="orange">🐾 Mascotas</Badge>}
        {profile.smoker && <Badge variant="blue">🚬 Fumador</Badge>}
        {!profile.smoker && <Badge variant="gray">🚭 No fuma</Badge>}
      </div>
    </Link>
  );
};

export default ProfileCard;
