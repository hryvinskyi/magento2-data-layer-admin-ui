<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\ViewModel;

use Hryvinskyi\DataLayerAdminUi\Api\ModuleScriptInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupPageConfigInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\MergedContributions;
use Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\ContributionStub;
use Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Http\BuildsRequests;
use Hryvinskyi\DataLayerAdminUi\ViewModel\SetupPage;
use Magento\Framework\Serialize\Serializer\JsonHexTag;
use Magento\Framework\App\RequestContentInterface;
use PHPUnit\Framework\TestCase;

/**
 * The page prints the configuration built for the scope the request names as JSON no value can break out of, loads
 * the wizard with every contribution's imports, and shows the wizard's own loading and failure phrases
 */
class SetupPageTest extends TestCase
{
    use BuildsRequests;

    /**
     * The request's scope parameters reach the configuration, and `<` and `>` in any value are escaped
     *
     * @return void
     */
    public function testPrintsTheConfigurationForTheRequestedScope(): void
    {
        $asked = [];
        $pageConfig = $this->createMock(SetupPageConfigInterface::class);
        $pageConfig->method('build')->willReturnCallback(
            static function (mixed $website, mixed $store) use (&$asked): array {
                $asked[] = [$website, $store];

                return ['phrases' => ['wizard.title' => '</script><script>alert(1)</script>']];
            }
        );
        $page = $this->page($pageConfig, $this->request('', ['website' => '1', 'store' => '3']));

        $json = $page->getConfigJson();

        self::assertSame([['1', '3']], $asked);
        self::assertStringNotContainsString('<', $json);
        self::assertStringNotContainsString('>', $json);
        self::assertSame(
            ['phrases' => ['wizard.title' => '</script><script>alert(1)</script>']],
            json_decode($json, true)
        );
    }

    /**
     * The wizard's entry is rendered with every contribution's imports
     *
     * @return void
     */
    public function testLoadsTheWizardWithEveryImport(): void
    {
        $rendered = [];
        $moduleScript = $this->createMock(ModuleScriptInterface::class);
        $moduleScript->method('render')->willReturnCallback(
            static function (string $entry, array $imports) use (&$rendered): string {
                $rendered[] = [$entry, $imports];

                return '<script type="module"></script>';
            }
        );
        $page = new SetupPage(
            $this->request(),
            $this->createMock(SetupPageConfigInterface::class),
            $this->contributions(),
            $moduleScript,
            new JsonHexTag()
        );

        self::assertSame('<script type="module"></script>', $page->getScripts());
        self::assertSame(
            [[
                'Hryvinskyi_DataLayerAdminUi::js/setup/wizard.js',
                ['preact' => 'Shell::js/preact.js', '@sample/plugin' => 'Sample::js/plugin.js'],
            ]],
            $rendered
        );
    }

    /**
     * The loading and failure lines are the wizard's phrases
     *
     * @return void
     */
    public function testLinesAreTheWizardsPhrases(): void
    {
        $page = $this->page($this->createMock(SetupPageConfigInterface::class), $this->request());

        self::assertSame('Loading…', $page->getLoadingText());
        self::assertSame('It did not start.', $page->getFailedText());
    }

    /**
     * Build the page over the configuration and request given
     *
     * @param SetupPageConfigInterface $pageConfig
     * @param RequestContentInterface $request
     * @return SetupPage
     */
    private function page(SetupPageConfigInterface $pageConfig, RequestContentInterface $request): SetupPage
    {
        return new SetupPage(
            $request,
            $pageConfig,
            $this->contributions(),
            $this->createMock(ModuleScriptInterface::class),
            new JsonHexTag()
        );
    }

    /**
     * Two contributions: the shell's and a plugin's
     *
     * @return MergedContributions
     */
    private function contributions(): MergedContributions
    {
        return new MergedContributions(ContributionStub::pool(
            new ContributionStub(
                ['wizard.loading' => 'Loading…', 'wizard.failed' => 'It did not start.'],
                [],
                ['preact' => 'Shell::js/preact.js']
            ),
            new ContributionStub(
                [],
                ['sample' => '@sample/plugin'],
                ['preact' => 'Shell::js/preact.js', '@sample/plugin' => 'Sample::js/plugin.js']
            )
        ));
    }
}
