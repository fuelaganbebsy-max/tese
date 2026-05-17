import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MemberType } from '../config';

interface MemberStore {
  activeType: MemberType;
  switchMember: (type: MemberType) => void;
}

export const useMemberStore = create<MemberStore>()(persist(
  (set) => ({
    activeType: 'KL',
    switchMember: (type) => set({ activeType: type }),
  }),
  {
    name: 'rebar-3d-member',
    version: 1,
  },
));
