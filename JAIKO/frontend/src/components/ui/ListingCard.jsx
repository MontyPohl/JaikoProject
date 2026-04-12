import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, BedDouble, Bath } from 'lucide-react';
import { Badge } from './index';

const ListingCard = ({ listing }) => {
  return (
    <Link to={`/listings/${listing.id}`} className="card group overflow-hidden p-0">
      <div className="aspect-[4/3] overflow-hidden relative">
        <img 
          src={listing.photos?.[0]?.photo_url || 'https://picsum.photos/seed/house/800/600'} 
          alt={listing.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 right-4">
          <Badge variant="dark" className="backdrop-blur-md bg-black/50 border border-white/20">
            {listing.type}
          </Badge>
        </div>
      </div>
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-slate-900 truncate flex-1">{listing.title}</h3>
          <p className="font-display font-extrabold text-blue-600 ml-2">
            ₲ {(listing.total_price / 1000000).toFixed(1)}M
          </p>
        </div>
        <div className="flex items-center gap-1 text-slate-400 text-xs mb-4">
          <MapPin size={12} />
          <span className="truncate">{listing.neighborhood}, {listing.city}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500 text-xs border-t border-slate-50 pt-4">
          <div className="flex items-center gap-1">
            <BedDouble size={14} className="text-orange-500" />
            <span>{listing.rooms} hab.</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath size={14} className="text-orange-500" />
            <span>{listing.bathrooms} baños</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ListingCard;
