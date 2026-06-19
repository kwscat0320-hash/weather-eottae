import React, { useRef, useState } from "react";
import { WeatherProvider } from "./context/WeatherContext";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import RoutePage from "./pages/RoutePage";
import SchedulePage from "./pages/SchedulePage";
import DetailPage from "./pages/DetailPage";
import SettingsPage from "./pages/SettingsPage";

const PAGES = {
  home: HomePage,
  route: RoutePage,
  schedule: SchedulePage,
  detail: DetailPage,
  settings: SettingsPage,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const scrollRef = useRef(null);
  const PageComponent = PAGES[currentPage];

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  return (
    <WeatherProvider>
      <div className="min-h-screen bg-slate-300 flex justify-center" style={{ fontFamily: "Inter, sans-serif" }}>
        <div
          className="w-full max-w-[393px] h-screen flex flex-col overflow-hidden relative"
        >
          <PageComponent scrollRef={scrollRef} />
          <BottomNav current={currentPage} onChange={handlePageChange} scrollRef={scrollRef} />
        </div>
      </div>
    </WeatherProvider>
  );
}