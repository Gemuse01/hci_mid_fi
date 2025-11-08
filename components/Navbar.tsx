import React from 'react';
import { Menu, Bell, Search, User as UserIcon, ChevronDown } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface NavbarProps {
  toggleSidebar: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar }) => {
  const { user } = useApp();

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-30 relative">
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="p-2 -ml-2 mr-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden"
        >
          <span className="sr-only">Open sidebar</span>
          <Menu size={24} />
        </button>
        {/* Mobile Logo shows when sidebar is closed on mobile */}
         <div className="md:hidden font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-600">
            FinGuide
          </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">


        {/* User Profile Summary */}
        <div className="flex items-center gap-3 pl-2 sm:pl-4 sm:border-l border-gray-200 sm:ml-2">
           <div className="hidden md:block text-right">
              <div className="text-sm font-bold text-gray-900 leading-tight">{user.name || 'Guest'}</div>
              <div className="text-xs font-medium text-gray-500 capitalize truncate max-w-[100px]">
                {user.persona !== 'UNDECIDED' ? user.persona.toLowerCase().replace('_', ' ') : 'New User'}
              </div>
           </div>
           <button className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 flex items-center justify-center text-primary-700 font-bold border border-primary-200 shadow-sm">
                {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={18} />}
              </div>
              <ChevronDown size={16} className="text-gray-400 hidden sm:block" />
           </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;