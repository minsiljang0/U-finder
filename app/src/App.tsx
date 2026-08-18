import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import TrialBanner from "./components/TrialBanner";
import GoldenFinder from "./pages/GoldenFinder";
import ShortsFinder from "./pages/ShortsFinder";
import Trending from "./pages/Trending";
import ChannelRanking from "./pages/ChannelRanking";
import Favorites from "./pages/Favorites";
import ApiKeySetup from "./pages/ApiKeySetup";
import Subscription from "./pages/Subscription";
import Pricing from "./pages/Pricing";

function PageWithBanner({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TrialBanner />
      {children}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              <PageWithBanner>
                <GoldenFinder />
              </PageWithBanner>
            }
          />
          <Route
            path="/shorts-finder"
            element={
              <PageWithBanner>
                <ShortsFinder />
              </PageWithBanner>
            }
          />
          <Route
            path="/trending"
            element={
              <PageWithBanner>
                <Trending />
              </PageWithBanner>
            }
          />
          <Route
            path="/ranking"
            element={
              <PageWithBanner>
                <ChannelRanking />
              </PageWithBanner>
            }
          />
          <Route
            path="/favorites"
            element={
              <PageWithBanner>
                <Favorites />
              </PageWithBanner>
            }
          />
          <Route
            path="/api-key"
            element={
              <PageWithBanner>
                <ApiKeySetup />
              </PageWithBanner>
            }
          />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/pricing" element={<Pricing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
