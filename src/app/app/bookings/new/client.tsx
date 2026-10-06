"use client";

import { BookingForm } from "@/components/app/booking-form";
import { createBookingAction } from "@/server/booking-actions";
import type { ComponentProps } from "react";

export function BookingFormClient(props: Omit<ComponentProps<typeof BookingForm>, "submit">) {
  return <BookingForm {...props} submit={(input) => createBookingAction(input)} />;
}
