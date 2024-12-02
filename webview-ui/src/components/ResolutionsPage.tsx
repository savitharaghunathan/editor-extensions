import React, { useState } from "react";
import {
  Page,
  PageSection,
  Title,
  Badge,
  Card,
  CardBody,
  CardTitle,
  Flex,
  FlexItem,
  Split,
  SplitItem,
  EmptyState,
  EmptyStateBody,
  Alert,
} from "@patternfly/react-core";
import { CheckCircleIcon, WarningTriangleIcon } from "@patternfly/react-icons";
import spacing from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import IncidentList from "./IncidentList";
import { FileChanges } from "./FileChanges";
import { CodePreview } from "./CodePreview";
import { LoadingScreen } from "./LoadingScreen";
import { LocalChange, Scope, Solution } from "@editor-extensions/shared";
import { useVscodeMessages } from "../hooks/useVscodeMessages";
import { sendVscodeMessage } from "../utils/vscodeMessaging";

const ResolutionPage: React.FC = () => {
  const [localChanges, setLocalChanges] = useState<LocalChange[]>([]);
  const [resolution, setResolution] = useState<(Solution & Scope) | null>(null);
  const [isResolved, setIsResolved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const messageHandler = (message: any) => {
    switch (message.type) {
      case "onDidChangeData": {
        const {
          isAnalyzing,
          isFetchingSolution,
          isStartingServer,
          solutionData,
          solutionScope,
          localChanges,
        } = message.value;

        setIsLoading(isAnalyzing || isFetchingSolution || isStartingServer);
        setLocalChanges(localChanges);
        if (solutionData) {
          handleSolutionResult({ ...solutionData, ...solutionScope });
        } else {
          console.log("No solution found for the incident.");
          setResolution(null);
          setIsResolved(false);
        }
        break;
      }
    }
  };

  useVscodeMessages(messageHandler);

  const handleSolutionResult = (solutionResponse: Solution & Scope) => {
    // Only reset states if it's a different solution
    if (!resolution || resolution.incident.uri !== solutionResponse.incident.uri) {
      setResolution(solutionResponse);
      setIsResolved(false);
    }
  };

  const handleFileClick = (change: LocalChange) =>
    sendVscodeMessage("viewFix", {
      change,
    });

  const handleAcceptClick = (change: LocalChange) =>
    sendVscodeMessage("applyFile", {
      change,
    });

  const handleRejectClick = (change: LocalChange) =>
    sendVscodeMessage("discardFile", {
      change,
    });

  const getRemainingFiles = () => {
    if (!resolution) {
      return [];
    }
    return localChanges.filter(({ state }) => state === "pending");
  };

  // Display loading screen when fetching solution
  if (isLoading) {
    return (
      <Page>
        <PageSection className="pf-v5-u-px-xl pf-v5-u-py-md">
          <LoadingScreen />
        </PageSection>
      </Page>
    );
  }

  // Display "Changes Applied" when the solution is accepted
  if (isResolved) {
    return (
      <Page>
        <PageSection className="pf-v6-u-px-xl pf-v6-u-py-md">
          <EmptyState variant="lg" icon={CheckCircleIcon} titleText="Changes Applied">
            <EmptyStateBody>
              The changes have been processed. You can close this panel or wait for the next
              incident.
            </EmptyStateBody>
          </EmptyState>
        </PageSection>
      </Page>
    );
  }

  // Display "No Active Solutions" when no resolution exists
  if (!resolution) {
    return (
      <Page>
        <PageSection className="pf-v5-u-px-xl pf-v5-u-py-md">
          <EmptyState variant="lg" icon={WarningTriangleIcon} titleText="No Active Solutions">
            <EmptyStateBody>There are no solutions to review at this time.</EmptyStateBody>
          </EmptyState>
        </PageSection>
      </Page>
    );
  }

  return (
    <Page>
      <PageSection className="pf-v5-u-px-xl pf-v5-u-py-md">
        <Flex>
          <FlexItem>
            <Title headingLevel="h1" size="2xl">
              <Flex spaceItems={{ default: "spaceItemsMd" }}>
                <FlexItem>
                  <WarningTriangleIcon className="pf-v5-u-danger-color-100" />
                </FlexItem>
                <FlexItem>Kai Results</FlexItem>
              </Flex>
            </Title>
          </FlexItem>
        </Flex>
      </PageSection>

      {resolution.encountered_errors.length > 0 && (
        <PageSection className="pf-v5-u-px-xl">
          <Alert variant="warning" title="Encountered Errors">
            <ul>
              {resolution.encountered_errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        </PageSection>
      )}

      <PageSection className="pf-v5-u-px-xl">
        <Split hasGutter>
          <SplitItem>
            <Card isFullHeight className="incident-list-card">
              <CardTitle>
                {resolution.violation?.description || "No Violation Data"}
                <Badge className={spacing.mSm}>
                  {resolution.violation?.category ?? "optional"}
                </Badge>
              </CardTitle>
              <CardBody>
                <IncidentList
                  incidents={[resolution.incident]}
                  selectedIncident={resolution.incident}
                  onSelectIncident={() => {}}
                />
              </CardBody>
            </Card>
          </SplitItem>

          <SplitItem isFilled>
            <Card className={spacing.mbSm}>
              <CardTitle>Affected Files</CardTitle>
              <CardBody>
                <FileChanges
                  changes={getRemainingFiles()}
                  onFileClick={handleFileClick}
                  onApplyFix={handleAcceptClick}
                  onRejectChanges={handleRejectClick}
                />
              </CardBody>
            </Card>
            {resolution.incident && (
              <Card className="pf-v5-u-mb-md">
                <CardTitle>Incident Details</CardTitle>
                <CardBody>
                  <CodePreview incident={resolution.incident} />
                </CardBody>
              </Card>
            )}
          </SplitItem>
        </Split>
      </PageSection>
    </Page>
  );
};

export default ResolutionPage;
