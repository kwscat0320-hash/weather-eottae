import React, { useRef, useState } from "react";
import { WeatherProvider } from "./context/WeatherContext";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import FavoritesPage from "./pages/FavoritesPage";
import SchedulePage from "./pages/SchedulePage";
import DetailPage from "./pages/DetailPage";
import SettingsPage from "./pages/SettingsPage";

const PAGES = {
  home: HomePage,
  favorites: FavoritesPage,
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
      <div className="flex justify-center" style={{ fontFamily: "Inter, sans-serif", width: "100%", height: "100dvh" }}>
        <div
          className="w-full flex flex-col overflow-hidden relative"
          style={{ height: "100dvh" }}
        >
          <PageComponent scrollRef={scrollRef} onNavigate={handlePageChange} />
          <BottomNav current={currentPage} onChange={handlePageChange} scrollRef={scrollRef} />
        </div>
      </div>
    </WeatherProvider>
  );
}