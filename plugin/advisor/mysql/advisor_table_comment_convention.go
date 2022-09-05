package mysql

// Framework code is generated by the generator.

import (
	"fmt"

	"github.com/pingcap/tidb/parser/ast"

	"github.com/bytebase/bytebase/plugin/advisor"
	"github.com/bytebase/bytebase/plugin/advisor/db"
)

var (
	_ advisor.Advisor = (*TableCommentConventionAdvisor)(nil)
	_ ast.Visitor     = (*tableCommentConventionChecker)(nil)
)

func init() {
	advisor.Register(db.MySQL, advisor.MySQLTableCommentConvention, &TableCommentConventionAdvisor{})
	advisor.Register(db.TiDB, advisor.MySQLTableCommentConvention, &TableCommentConventionAdvisor{})
}

// TableCommentConventionAdvisor is the advisor checking for table comment convention.
type TableCommentConventionAdvisor struct {
}

// Check checks for table comment convention.
func (*TableCommentConventionAdvisor) Check(ctx advisor.Context, statement string) ([]advisor.Advice, error) {
	stmtList, errAdvice := parseStatement(statement, ctx.Charset, ctx.Collation)
	if errAdvice != nil {
		return errAdvice, nil
	}

	level, err := advisor.NewStatusBySQLReviewRuleLevel(ctx.Rule.Level)
	if err != nil {
		return nil, err
	}
	payload, err := advisor.UnmarshalCommentConventionRulePayload(ctx.Rule.Payload)
	if err != nil {
		return nil, err
	}
	checker := &tableCommentConventionChecker{
		level:     level,
		title:     string(ctx.Rule.Type),
		required:  payload.Required,
		maxLength: payload.MaxLength,
	}

	for _, stmt := range stmtList {
		checker.text = stmt.Text()
		checker.line = stmt.OriginTextPosition()
		(stmt).Accept(checker)
	}

	if len(checker.adviceList) == 0 {
		checker.adviceList = append(checker.adviceList, advisor.Advice{
			Status:  advisor.Success,
			Code:    advisor.Ok,
			Title:   "OK",
			Content: "",
		})
	}
	return checker.adviceList, nil
}

type tableCommentConventionChecker struct {
	adviceList []advisor.Advice
	level      advisor.Status
	title      string
	text       string
	line       int
	required   bool
	maxLength  int
}

// Enter implements the ast.Visitor interface.
func (checker *tableCommentConventionChecker) Enter(in ast.Node) (ast.Node, bool) {
	if node, ok := in.(*ast.CreateTableStmt); ok {
		exist, comment := tableComment(node.Options)
		if checker.required && !exist {
			checker.adviceList = append(checker.adviceList, advisor.Advice{
				Status:  checker.level,
				Code:    advisor.NoTableComment,
				Title:   checker.title,
				Content: fmt.Sprintf("Table `%s` requires comments", node.Table.Name.O),
				Line:    checker.line,
			})
		}
		if checker.maxLength >= 0 && len(comment) > checker.maxLength {
			checker.adviceList = append(checker.adviceList, advisor.Advice{
				Status:  checker.level,
				Code:    advisor.TableCommentTooLong,
				Title:   checker.title,
				Content: fmt.Sprintf("The length of table `%s` comment should be within %d characters", node.Table.Name.O, checker.maxLength),
				Line:    checker.line,
			})
		}
	}

	return in, false
}

// Leave implements the ast.Visitor interface.
func (*tableCommentConventionChecker) Leave(in ast.Node) (ast.Node, bool) {
	return in, true
}

func tableComment(options []*ast.TableOption) (bool, string) {
	for _, option := range options {
		if option.Tp == ast.TableOptionComment {
			return true, option.StrValue
		}
	}

	return false, ""
}