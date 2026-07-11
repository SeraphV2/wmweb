from fastapi import APIRouter, Depends
from database import Database
from deps import get_db

router = APIRouter()


@router.get("/monthly-revenue")
def monthly_revenue(year: int, db: Database = Depends(get_db)):
    return db.get_monthly_revenue(year)


@router.get("/monthly-expenses")
def monthly_expenses(year: int, db: Database = Depends(get_db)):
    return db.get_monthly_expenses(year)


@router.get("/expense-by-category")
def expense_by_category(year: int = None, db: Database = Depends(get_db)):
    return db.get_expense_by_category(year=year)


@router.get("/summary")
def summary(year: int, db: Database = Depends(get_db)):
    rev_rows = db.get_monthly_revenue(year)
    exp_rows = db.get_monthly_expenses(year)
    total_rev = sum(r['revenue'] for r in rev_rows)
    total_exp = sum(r['total'] for r in exp_rows)
    proj_cnt = db.count_active_projects_by_year(year)
    return {
        "revenue": total_rev,
        "expenses": total_exp,
        "profit": total_rev - total_exp,
        "projects": proj_cnt,
    }
