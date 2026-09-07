import type { Metadata } from "next";
import { ParkingRegister } from "./parking-register";

export const metadata: Metadata = {
  title: "Parking Bay Register",
  description: "Private tablet parking bay check-in and check-out register.",
};

export default function Home() {
  return <ParkingRegister />;
}
