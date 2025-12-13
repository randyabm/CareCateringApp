# **CareCateringApp 🏥**

**CareCateringApp** is a centralized Order Management System (OMS) designed to optimize internal logistics and patient catering services at **hospitals**. It bridges the gap between nursing staff, the kitchen, and supply chain management in a unified real-time platform.

## **🚀 Key Features**

* **📦 Ward Groceries (Supply Chain):**  
  * Custom catalogs per ward (Clinical vs. Admin).  
  * **Budget Control:** Automated email triggers to cost center managers for high-value items.  
  * **Mass Setup:** Deployment templates (e.g., "Surgical Kit") for rapid ward onboarding.  
* **🍽️ Patient Catering (Clinical Safety):**  
  * **Unified Diet Rules:** Master management of Primary Diets (e.g., Diabetic) and Dietary Flags (Allergies/Dislikes).  
  * **Safety First:** Mandatory validation for Bed Numbers and Diet Codes.  
  * **Time Rules:** Automated cut-off times for hot meals.  
* **🔄 "Proactive" Store Man:**  
  * **Gap Analysis:** Algorithm that calculates Ideal Stock \- Current Stock to auto-generate replenishment orders.  
  * **Audit Mode:** Tablet-optimized interface for inventory rounds.  
* **📡 Real-Time Dispatch:**  
  * Split-view dashboard for the Kitchen (Groceries vs. Diets).  
  * Drag-and-drop task reassignment between Store Man and Runners.

## **🛠️ Tech Stack**

The project utilizes a modern, type-safe, serverless architecture:

* **Frontend:** [Next.js 14](https://nextjs.org/) (App Router, React)  
* **Language:** [TypeScript](https://www.typescriptlang.org/)  
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)  
* **Backend & Auth:** [Supabase](https://supabase.com/)  
* **Database:** PostgreSQL (with Row Level Security)  
* **State Management:** TanStack Query

## **📂 Project Structure**

/src  
  /app           \# Next.js App Router  
    /dashboard   \# Nurse Interface (Groceries & Catering)  
    /kitchen     \# Dispatcher Console (Split View)  
    /audit       \# Store Man Tablet Interface  
    /admin       \# Configuration (Products, Templates, Diet Codes)  
  /components    \# Reusable UI Components  
  /lib           \# Supabase Clients & Utils  
  /types         \# TypeScript Definitions (Database Schema)

## **🏁 Getting Started**

1. **Clone the repository:**

git clone \[https://github.com/box-hill/care-catering-app.git\](https://github.com/box-hill/care-catering-app.git)

2.   
3. **Install dependencies:**

npm install

4.   
5. Environment Variables:  
   Rename .env.example to .env.local and add your Supabase credentials:

NEXT\_PUBLIC\_SUPABASE\_URL=your-project-url  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=your-anon-key

6.   
7. **Run the development server:**

npm run dev

8. 

## **🔐 Security & Database**

This project relies on **PostgreSQL Row Level Security (RLS)**.

* **Migration:** Run the SQL scripts located in /supabase/migrations to set up tables and security policies.  
* **Roles:** Ensure users are assigned the correct role (nurse, store\_man, admin) in the PROFILES table upon signup.

**Developed for Box Hill Hospital \- Catering Department**

