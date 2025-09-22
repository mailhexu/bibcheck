import React from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";

type MainLayoutProps = {
  children: React.ReactNode;
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => (
  <Container maxWidth="md">
    <Box sx={{ my: 4 }}>
      {children}
    </Box>
  </Container>
);

export default MainLayout;
