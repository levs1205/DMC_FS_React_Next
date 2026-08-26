import type { BookingStatus, RoomType } from "@/lib/generated/prisma/enums"

export type { BookingStatus, RoomType }

export interface BookingListItem {
  id: number;
  roomId: number;
  roomName: string;
  roomType: RoomType;
  userId: number;
  userName: string | null;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  totalPrice: number;
}


